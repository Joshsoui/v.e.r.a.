import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guard";
import { getReportOrThrow } from "@/lib/reports/access";
import { updateReportSettingsSchema } from "@/lib/validation/reports";
import { parseChapters, parseWritingStyles, parseValidatorRules } from "@/lib/formats/types";
import { computeChapterIssues } from "@/lib/reports/service";
import { persistedStatementsArraySchema, missingInfoArraySchema } from "@/lib/reports/types";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const report = await getReportOrThrow(id, session);
    const validatorRules = parseValidatorRules(report.formatTemplate.validatorRules);

    return NextResponse.json({
      report: {
        id: report.id,
        title: report.title,
        status: report.status,
        currentStep: report.currentStep,
        version: report.version,
        writingStyleKey: report.writingStyleKey,
        addChecklist: report.addChecklist,
        addConceptFootnote: report.addConceptFootnote,
        expiresAt: report.expiresAt,
        contentDeletedAt: report.contentDeletedAt,
        formatTemplate: {
          id: report.formatTemplate.id,
          name: report.formatTemplate.name,
          chapters: parseChapters(report.formatTemplate.chapters),
          writingStyles: parseWritingStyles(report.formatTemplate.writingStyles),
        },
        sources: report.sources.map((s) => ({
          id: s.id,
          filename: s.filename,
          sourceType: s.sourceType,
          charCount: s.charCount,
          createdAt: s.createdAt,
        })),
        chapters: report.chapters.map((c) => {
          const statements = persistedStatementsArraySchema.parse(c.statements);
          const missingInfo = missingInfoArraySchema.parse(c.missingInfo);
          const { issues } = computeChapterIssues(statements, missingInfo, validatorRules, c.key);
          return {
            id: c.id,
            key: c.key,
            title: c.title,
            order: c.order,
            statements,
            missingInfo,
            status: c.status,
            editedByUser: c.editedByUser,
            issues,
          };
        }),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const existing = await getReportOrThrow(id, session);

    const body = await req.json().catch(() => null);
    const parsed = updateReportSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Ongeldige invoer.");
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.formatTemplateId !== undefined) {
      const format = await prisma.formatTemplate.findUnique({
        where: { id: parsed.data.formatTemplateId },
      });
      if (!format) throw new ApiError(400, "Onbekend format.");
      data.formatTemplateId = format.id;
    }
    if (parsed.data.writingStyleKey !== undefined) data.writingStyleKey = parsed.data.writingStyleKey;
    if (parsed.data.addChecklist !== undefined) data.addChecklist = parsed.data.addChecklist;
    if (parsed.data.addConceptFootnote !== undefined)
      data.addConceptFootnote = parsed.data.addConceptFootnote;
    if (parsed.data.currentStep !== undefined) data.currentStep = parsed.data.currentStep;

    const updated = await prisma.report.update({
      where: { id: existing.id },
      data,
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "report.update_settings",
      entityType: "Report",
      entityId: updated.id,
      ipHash: hashIp(getClientIp(req)),
    });

    return NextResponse.json({ report: { id: updated.id, currentStep: updated.currentStep } });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const report = await getReportOrThrow(id, session);

    await prisma.report.delete({ where: { id: report.id } });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "report.delete",
      entityType: "Report",
      entityId: report.id,
      ipHash: hashIp(getClientIp(req)),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
