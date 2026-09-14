import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guard";
import { getReportOrThrow } from "@/lib/reports/access";
import { parseChapters, parseWritingStyles, parseValidatorRules } from "@/lib/formats/types";
import { segmentSources } from "@/lib/ai/sourceSegments";
import { getAIProvider } from "@/lib/ai";
import { findUnverifiedSourceRefs, validateChapterKeyCompleteness } from "@/lib/validators";
import type { PersistedStatement } from "@/lib/reports/types";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError, rateLimitedResponse } from "@/lib/utils/errors";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const report = await getReportOrThrow(id, session);

    const rl = checkRateLimit(`ai:${session.userId}`, env.rateLimitAiMax, env.rateLimitAiWindowMs);
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs);

    if (report.sources.length === 0) {
      throw new ApiError(400, "Voeg eerst brontekst toe voordat je een analyse start.");
    }

    const chapters = parseChapters(report.formatTemplate.chapters);
    const writingStyles = parseWritingStyles(report.formatTemplate.writingStyles);
    const validatorRules = parseValidatorRules(report.formatTemplate.validatorRules);
    const writingStyle = writingStyles.find((w) => w.key === report.writingStyleKey) ?? null;

    const segments = segmentSources(
      report.sources.map((s) => ({
        id: s.id,
        filename: s.filename,
        extractedText: s.extractedText,
      })),
    );

    const provider = getAIProvider();
    const analysis = await provider.analyzeReport({
      disciplineName: report.formatTemplate.documentType.discipline.name,
      documentTypeName: report.formatTemplate.documentType.name,
      chapters,
      writingStyle,
      segments,
    });

    const completeness = validateChapterKeyCompleteness(
      analysis.chapters.map((c) => c.key),
      chapters.map((c) => c.key),
    );
    if (
      completeness.missing.length > 0 ||
      completeness.unexpected.length > 0 ||
      completeness.duplicates.length > 0
    ) {
      throw new ApiError(
        502,
        "De AI-output kwam niet overeen met het verwachte hoofdstukformat. Probeer het opnieuw.",
      );
    }

    const chapterDefsByKey = new Map(chapters.map((c) => [c.key, c]));

    await prisma.$transaction(async (tx) => {
      for (const chapterResult of analysis.chapters) {
        const def = chapterDefsByKey.get(chapterResult.key);
        if (!def) continue; // kan niet gebeuren na completeness-check, maar defensief

        const unverified = findUnverifiedSourceRefs(chapterResult.statements, segments);
        const unverifiedIndexes = new Set(unverified.map((u) => u.statementIndex));

        const persistedStatements: PersistedStatement[] = chapterResult.statements.map(
          (s, idx) => ({
            id: randomUUID(),
            text: s.text,
            category: s.category,
            sourceRefs: s.sourceRefs,
            origin: "AI",
            sourceVerified: !unverifiedIndexes.has(idx),
          }),
        );

        await tx.reportChapter.upsert({
          where: { reportId_key: { reportId: report.id, key: chapterResult.key } },
          create: {
            reportId: report.id,
            key: chapterResult.key,
            title: def.title,
            order: def.order,
            statements: persistedStatements,
            missingInfo: chapterResult.missingInfo,
            status: "NIET_GECONTROLEERD",
            editedByUser: false,
          },
          update: {
            title: def.title,
            order: def.order,
            statements: persistedStatements,
            missingInfo: chapterResult.missingInfo,
            status: "NIET_GECONTROLEERD",
            editedByUser: false,
          },
        });
      }

      await tx.report.update({
        where: { id: report.id },
        data: { status: "CONTROLE", currentStep: Math.max(report.currentStep, 4) },
      });
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "report.ai_analyze",
      entityType: "Report",
      entityId: report.id,
      ipHash: hashIp(getClientIp(req)),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
