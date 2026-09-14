import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guard";
import { getReportOrThrow } from "@/lib/reports/access";
import { generateReportDocx } from "@/lib/docx/export";
import { persistedStatementsArraySchema, missingInfoArraySchema } from "@/lib/reports/types";
import { sanitizeFilename } from "@/lib/utils/filename";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const report = await getReportOrThrow(id, session);

    if (report.chapters.length === 0) {
      throw new ApiError(400, "Er is nog geen inhoud gegenereerd voor dit rapport. Doorloop eerst de VERA-analyse.");
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
    });
    if (!organization) {
      throw new ApiError(404, "Niet gevonden.");
    }

    const updated = await prisma.report.update({
      where: { id: report.id },
      data: { version: { increment: 1 }, status: "GEEXPORTEERD" },
    });

    const buffer = await generateReportDocx({
      documentTypeName: report.formatTemplate.documentType.name,
      formatName: report.formatTemplate.name,
      organizationName: organization.name,
      municipality: organization.municipality,
      title: report.title,
      version: updated.version,
      addChecklist: report.addChecklist,
      addConceptFootnote: report.addConceptFootnote,
      generatedAt: new Date(),
      chapters: report.chapters.map((c) => ({
        title: c.title,
        statements: persistedStatementsArraySchema.parse(c.statements),
        missingInfo: missingInfoArraySchema.parse(c.missingInfo),
        status: c.status,
      })),
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "report.export",
      entityType: "Report",
      entityId: report.id,
      ipHash: hashIp(getClientIp(req)),
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(report.title)}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
