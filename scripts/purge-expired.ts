// Retentie-purge: verwijdert de dossierinhoud (bronnen + hoofdstukstatements)
// van rapporten waarvan expiresAt verstreken is. De Report-rij zelf blijft
// bestaan met uitsluitend metadata (organisatie, status, tellers, datums) —
// dat is precies het privacy-by-design-gedrag uit de README.
//
// Bedoeld om periodiek gedraaid te worden (bv. handmatig, of via een externe
// scheduler / Render cron job die `npm run purge:expired` aanroept). Bewust
// GEEN aparte Render-achtergrondservice in render.yaml, conform de opdracht
// (1 webservice, database extern op Supabase).

import { prisma } from "@/lib/db/prisma";

async function main() {
  const now = new Date();

  const expiredReports = await prisma.report.findMany({
    where: { expiresAt: { lte: now }, contentDeletedAt: null },
    select: { id: true },
  });

  console.log(`Retentie-purge: ${expiredReports.length} rapport(en) verlopen.`);

  for (const report of expiredReports) {
    await prisma.$transaction([
      prisma.sourceDocument.deleteMany({ where: { reportId: report.id } }),
      prisma.reportChapter.updateMany({
        where: { reportId: report.id },
        data: { statements: [], missingInfo: [] },
      }),
      prisma.report.update({
        where: { id: report.id },
        data: { contentDeletedAt: now },
      }),
    ]);
    console.log(`  → inhoud verwijderd voor rapport ${report.id}`);
  }

  console.log("Retentie-purge voltooid.");
}

main()
  .catch((err) => {
    console.error("Retentie-purge mislukt:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
