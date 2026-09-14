// Retentie-purge: verwijdert de dossierinhoud (bronnen + hoofdstukstatements
// + eigen referentie) van rapporten waarvan expiresAt verstreken is. De
// Report-rij zelf blijft bestaan met uitsluitend metadata (organisatie,
// status, tellers, datums) — dat is precies het privacy-by-design-gedrag uit
// de README. De daadwerkelijke logica staat in src/lib/reports/purge.ts
// (getest in tests/retention-purge.test.ts); dit script is een dunne
// CLI-wrapper.
//
// Bedoeld om periodiek gedraaid te worden (bv. handmatig, of via een externe
// scheduler / Render cron job die `npm run purge:expired` aanroept). Bewust
// GEEN aparte Render-achtergrondservice in render.yaml, conform de opdracht
// (1 webservice, database extern op Supabase).

import { prisma } from "@/lib/db/prisma";
import { purgeExpiredReports } from "@/lib/reports/purge";

async function main() {
  const purgedIds = await purgeExpiredReports();
  console.log(`Retentie-purge: ${purgedIds.length} rapport(en) verlopen.`);
  for (const id of purgedIds) {
    console.log(`  → inhoud verwijderd voor rapport ${id}`);
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
