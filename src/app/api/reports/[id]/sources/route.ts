import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guard";
import { getReportOrThrow } from "@/lib/reports/access";
import { extractTextFromDocx } from "@/lib/upload/parseDocx";
import {
  assertValidUploadFile,
  assertValidAudioFile,
  isAudioUpload,
  assertWithinFileCount,
  assertNonEmptyText,
  assertTotalInputWithinLimit,
  UploadValidationException,
} from "@/lib/upload/validate";
import { getAIProvider } from "@/lib/ai";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError, jsonError, rateLimitedResponse } from "@/lib/utils/errors";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type NewSource = {
  filename: string;
  sourceType: "TEKST" | "DOCX" | "AUDIO";
  extractedText: string;
  charCount: number;
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const report = await getReportOrThrow(id, session);

    const formData = await req.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    const pastedText = formData.get("text");
    const pastedFilename = formData.get("filename");

    assertWithinFileCount(report.sources.length, files.length + (pastedText ? 1 : 0));

    const newSources: NewSource[] = [];

    if (typeof pastedText === "string" && pastedText.trim().length > 0) {
      const trimmed = pastedText.trim();
      assertNonEmptyText(trimmed, "Geplakte tekst");
      newSources.push({
        filename:
          typeof pastedFilename === "string" && pastedFilename.trim().length > 0
            ? pastedFilename.trim().slice(0, 200)
            : "Geplakte tekst",
        sourceType: "TEKST",
        extractedText: trimmed,
        charCount: trimmed.length,
      });
    }

    for (const file of files) {
      if (isAudioUpload(file)) {
        assertValidAudioFile({ size: file.size, type: file.type, name: file.name });

        // Elke transcriptie is een betaalde externe API-aanroep — apart
        // gerate-limit t.o.v. de VERA-analyse zelf (zie env.rateLimitTranscribe*).
        const rl = checkRateLimit(
          `transcribe:${session.userId}`,
          env.rateLimitTranscribeMax,
          env.rateLimitTranscribeWindowMs,
        );
        if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs);

        // De audio leeft uitsluitend als deze buffer, alleen voor de duur
        // van de transcriptie-aanroep — er wordt nergens audio weggeschreven
        // (niet naar schijf, niet naar de database). Alleen het transcript
        // (platte tekst) hieronder wordt bewaard, net als elke andere bron.
        const buffer = Buffer.from(await file.arrayBuffer());
        const text = await getAIProvider().transcribeAudio({
          buffer,
          filename: file.name,
          mimeType: file.type || "audio/webm",
        });
        assertNonEmptyText(text, `Opname "${file.name}"`);
        newSources.push({
          filename: file.name,
          sourceType: "AUDIO",
          extractedText: text,
          charCount: text.length,
        });
        continue;
      }

      assertValidUploadFile({ size: file.size, type: file.type, name: file.name });
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractTextFromDocx(buffer);
      assertNonEmptyText(text, `Bestand "${file.name}"`);
      newSources.push({
        filename: file.name,
        sourceType: "DOCX",
        extractedText: text,
        charCount: text.length,
      });
    }

    if (newSources.length === 0) {
      throw new ApiError(400, "Geen brontekst of bestanden aangeleverd.");
    }

    const existingChars = report.sources.reduce((sum, s) => sum + s.charCount, 0);
    const addingChars = newSources.reduce((sum, s) => sum + s.charCount, 0);
    assertTotalInputWithinLimit(existingChars + addingChars);

    await prisma.$transaction([
      prisma.sourceDocument.createMany({
        data: newSources.map((s) => ({
          reportId: report.id,
          filename: s.filename,
          sourceType: s.sourceType,
          extractedText: s.extractedText,
          charCount: s.charCount,
        })),
      }),
      prisma.report.update({
        where: { id: report.id },
        data: { status: "BRONNEN", currentStep: Math.max(report.currentStep, 2) },
      }),
    ]);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "report.sources_upload",
      entityType: "Report",
      entityId: report.id,
      ipHash: hashIp(getClientIp(req)),
    });

    return NextResponse.json({ ok: true, added: newSources.length }, { status: 201 });
  } catch (err) {
    if (err instanceof UploadValidationException) {
      return jsonError(400, err.message);
    }
    return handleApiError(err);
  }
}
