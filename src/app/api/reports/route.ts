import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guard";
import { createReportSchema } from "@/lib/validation/reports";
import { generateReportTitle, computeExpiresAt } from "@/lib/reports/service";
import { parseChapters } from "@/lib/formats/types";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const reports = await prisma.report.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { updatedAt: "desc" },
      include: { formatTemplate: { include: { documentType: true }, omit: { sourceDocx: true } } },
    });
    return NextResponse.json({
      reports: reports.map((r) => ({
        id: r.id,
        title: r.title,
        reference: r.reference,
        status: r.status,
        currentStep: r.currentStep,
        documentTypeName: r.formatTemplate.documentType.name,
        formatName: r.formatTemplate.name,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        expiresAt: r.expiresAt,
        contentDeletedAt: r.contentDeletedAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const body = await req.json().catch(() => null);
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Ongeldige invoer.");
    }

    const formatTemplate = await prisma.formatTemplate.findUnique({
      where: { id: parsed.data.formatTemplateId },
      include: { documentType: true },
    });
    if (!formatTemplate) {
      throw new ApiError(400, "Onbekend format.");
    }

    // Valideer dat het format tenminste geldig geconfigureerd is.
    parseChapters(formatTemplate.chapters);

    const now = new Date();
    const report = await prisma.report.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        formatTemplateId: formatTemplate.id,
        writingStyleKey: parsed.data.writingStyleKey ?? null,
        title: generateReportTitle(formatTemplate.documentType.name, now),
        reference: parsed.data.reference || null,
        status: "INSTELLINGEN",
        currentStep: 1,
        addChecklist: parsed.data.addChecklist ?? true,
        addConceptFootnote: parsed.data.addConceptFootnote ?? true,
        expiresAt: computeExpiresAt(now),
      },
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "report.create",
      entityType: "Report",
      entityId: report.id,
      ipHash: hashIp(getClientIp(req)),
    });

    return NextResponse.json({ report: { id: report.id } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
