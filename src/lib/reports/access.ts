import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/utils/errors";
import type { SessionPayload } from "@/lib/auth/session";

/**
 * Haalt een rapport op, altijd scoped op organizationId. Bestaat het rapport
 * niet, of hoort het bij een andere organisatie? Dan gooien we exact dezelfde
 * generieke 404 — dat voorkomt IDOR (Insecure Direct Object Reference): een
 * aanvaller kan nooit het bestaan van andermans data afleiden uit het
 * verschil tussen "niet gevonden" en "geen toegang".
 */
export async function getReportOrThrow(reportId: string, session: SessionPayload) {
  const report = await prisma.report.findFirst({
    where: { id: reportId, organizationId: session.organizationId },
    include: {
      formatTemplate: { include: { documentType: { include: { discipline: true } } } },
      sources: { orderBy: { createdAt: "asc" } },
      chapters: { orderBy: { order: "asc" } },
    },
  });
  if (!report) {
    throw new ApiError(404, "Niet gevonden.");
  }
  return report;
}
