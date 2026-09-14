import { prisma } from "@/lib/db/prisma";

/**
 * Retentie-purge: verwijdert de dossierinhoud (bronnen, hoofdstukstatements en
 * de eigen referentie) van rapporten waarvan expiresAt verstreken is. De
 * Report-rij zelf blijft bestaan met uitsluitend metadata (organisatie,
 * status, tellers, datums) — zie scripts/purge-expired.ts en het
 * privacyhoofdstuk in de README.
 */
export async function purgeExpiredReports(now: Date = new Date()): Promise<string[]> {
  const expiredReports = await prisma.report.findMany({
    where: { expiresAt: { lte: now }, contentDeletedAt: null },
    select: { id: true },
  });

  for (const report of expiredReports) {
    await prisma.$transaction([
      prisma.sourceDocument.deleteMany({ where: { reportId: report.id } }),
      prisma.reportChapter.updateMany({
        where: { reportId: report.id },
        data: { statements: [], missingInfo: [] },
      }),
      prisma.report.update({
        where: { id: report.id },
        data: { contentDeletedAt: now, reference: null },
      }),
    ]);
  }

  return expiredReports.map((r) => r.id);
}
