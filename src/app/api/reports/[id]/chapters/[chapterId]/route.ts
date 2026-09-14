import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guard";
import { getReportOrThrow } from "@/lib/reports/access";
import { updateChapterSchema } from "@/lib/validation/reports";
import { parseValidatorRules } from "@/lib/formats/types";
import { segmentSources } from "@/lib/ai/sourceSegments";
import { findUnverifiedSourceRefs, validateChapter } from "@/lib/validators";
import type { PersistedStatement } from "@/lib/reports/types";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; chapterId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id, chapterId } = await params;
    const report = await getReportOrThrow(id, session);

    const chapter = report.chapters.find((c) => c.id === chapterId);
    if (!chapter) {
      throw new ApiError(404, "Niet gevonden.");
    }

    const body = await req.json().catch(() => null);
    const parsed = updateChapterSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Ongeldige invoer.");
    }

    const segments = segmentSources(
      report.sources.map((s) => ({
        id: s.id,
        filename: s.filename,
        extractedText: s.extractedText,
      })),
    );

    const statementsForVerification = parsed.data.statements.map((s) => ({
      text: s.text,
      category: s.category,
      sourceRefs: s.sourceRefs,
    }));
    const unverified = findUnverifiedSourceRefs(statementsForVerification, segments);
    const unverifiedIndexes = new Set(unverified.map((u) => u.statementIndex));

    const persistedStatements: PersistedStatement[] = parsed.data.statements.map((s, idx) => ({
      id: s.id && s.id.length > 0 ? s.id : randomUUID(),
      text: s.text,
      category: s.category,
      sourceRefs: s.sourceRefs,
      origin: s.origin,
      // Handmatig door de gebruiker toegevoegde/bewerkte tekst is per definitie
      // niet AI-gegenereerd en hoeft dus niet tegen brontekst geverifieerd te
      // worden; AI-afkomstige statements blijven wel onderhevig aan de check.
      sourceVerified: s.origin === "USER" ? true : !unverifiedIndexes.has(idx),
      // De client stuurt `original` (indien aanwezig) ongewijzigd terug; de
      // server herschrijft dit nooit, zodat "terug naar AI-versie" altijd de
      // echte oorspronkelijke AI-output blijft tonen.
      original: s.original ?? null,
    }));

    const validatorRules = parseValidatorRules(report.formatTemplate.validatorRules);
    let status: "COMPLEET" | "ONVOLLEDIG" | "NIET_GECONTROLEERD" = "NIET_GECONTROLEERD";
    if (parsed.data.markReviewed) {
      const result = validateChapter(
        { statements: persistedStatements, missingInfo: parsed.data.missingInfo },
        validatorRules[chapter.key],
      );
      status = result.status;
    }

    const updated = await prisma.reportChapter.update({
      where: { id: chapter.id },
      data: {
        statements: persistedStatements,
        missingInfo: parsed.data.missingInfo,
        status,
        editedByUser: true,
      },
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "report.chapter_update",
      entityType: "ReportChapter",
      entityId: updated.id,
      ipHash: hashIp(getClientIp(req)),
    });

    return NextResponse.json({ chapter: { id: updated.id, status: updated.status } });
  } catch (err) {
    return handleApiError(err);
  }
}
