import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { purgeExpiredReports } from "@/lib/reports/purge";

// Draait tegen de echte (lokale) testdatabase — de retentie-purge is een
// database-transactie, niet zinvol te mocken. Dekt het privacy-by-design
// gedrag: dossierinhoud (bronnen, hoofdstukstatements, eigen referentie)
// verdwijnt bij verlopen rapporten, de rapport-rij zelf blijft als metadata
// bestaan.

let org: { id: string };
let user: { id: string };
let formatTemplateId: string;
let documentTypeId: string;
let disciplineId: string;
let expiredReportId: string;
let activeReportId: string;
let expiredChapterId: string;

beforeAll(async () => {
  const discipline = await prisma.discipline.create({
    data: { code: `test-purge-discipline-${Date.now()}`, name: "Testvakgebied purge" },
  });
  disciplineId = discipline.id;

  const documentType = await prisma.documentType.create({
    data: { disciplineId: discipline.id, code: "test-purge-doctype", name: "Testdocument purge" },
  });
  documentTypeId = documentType.id;

  const formatTemplate = await prisma.formatTemplate.create({
    data: {
      documentTypeId: documentType.id,
      name: "Testformat purge",
      isDefault: true,
      chapters: [{ key: "intro", title: "Intro", order: 0, instructions: "Test", requiredElements: [] }],
      writingStyles: [],
      validatorRules: {},
    },
  });
  formatTemplateId = formatTemplate.id;

  org = await prisma.organization.create({ data: { name: "Organisatie Purge" } });
  user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `user-purge-${Date.now()}@example.test`,
      passwordHash: "x",
      name: "Gebruiker Purge",
      role: "BEHEERDER",
    },
  });

  const expiredReport = await prisma.report.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      formatTemplateId: formatTemplate.id,
      title: "Verlopen testrapport",
      reference: "zaak Verlopen Testpersoon",
      status: "CONTROLE",
      expiresAt: new Date(Date.now() - 86_400_000), // gisteren verlopen
    },
  });
  expiredReportId = expiredReport.id;

  await prisma.sourceDocument.create({
    data: {
      reportId: expiredReportId,
      filename: "notitie.txt",
      sourceType: "TEKST",
      extractedText: "Gevoelige brontekst die verwijderd moet worden.",
      charCount: 42,
    },
  });

  const expiredChapter = await prisma.reportChapter.create({
    data: {
      reportId: expiredReportId,
      key: "intro",
      title: "Intro",
      order: 0,
      statements: [
        { id: "s1", text: "Gevoelige bewering.", category: "FEIT", sourceRefs: [], origin: "AI", sourceVerified: true },
      ],
      missingInfo: ["Gevoelig openstaand punt."],
      status: "NIET_GECONTROLEERD",
    },
  });
  expiredChapterId = expiredChapter.id;

  const activeReport = await prisma.report.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      formatTemplateId: formatTemplate.id,
      title: "Actief testrapport",
      reference: "zaak Actieve Testpersoon",
      status: "CONTROLE",
      expiresAt: new Date(Date.now() + 86_400_000), // morgen pas verlopen
    },
  });
  activeReportId = activeReport.id;
});

afterAll(async () => {
  await prisma.report.deleteMany({ where: { organizationId: org.id } });
  await prisma.user.deleteMany({ where: { organizationId: org.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.formatTemplate.delete({ where: { id: formatTemplateId } });
  await prisma.documentType.delete({ where: { id: documentTypeId } });
  await prisma.discipline.delete({ where: { id: disciplineId } });
  await prisma.$disconnect();
});

describe("purgeExpiredReports", () => {
  it("verwijdert bronnen, hoofdstukinhoud en eigen referentie van verlopen rapporten", async () => {
    const purgedIds = await purgeExpiredReports();
    expect(purgedIds).toContain(expiredReportId);

    const report = await prisma.report.findUniqueOrThrow({ where: { id: expiredReportId } });
    expect(report.contentDeletedAt).not.toBeNull();
    expect(report.reference).toBeNull();
    // Metadata blijft behouden:
    expect(report.title).toBe("Verlopen testrapport");
    expect(report.status).toBe("CONTROLE");

    const sources = await prisma.sourceDocument.findMany({ where: { reportId: expiredReportId } });
    expect(sources).toHaveLength(0);

    const chapter = await prisma.reportChapter.findUniqueOrThrow({ where: { id: expiredChapterId } });
    expect(chapter.statements).toEqual([]);
    expect(chapter.missingInfo).toEqual([]);
    // Hoofdstuk-metadata (titel, volgorde) blijft behouden:
    expect(chapter.title).toBe("Intro");
  });

  it("laat nog niet-verlopen rapporten volledig ongemoeid", async () => {
    await purgeExpiredReports();
    const report = await prisma.report.findUniqueOrThrow({ where: { id: activeReportId } });
    expect(report.contentDeletedAt).toBeNull();
    expect(report.reference).toBe("zaak Actieve Testpersoon");
  });

  it("is idempotent: een tweede aanroep purget hetzelfde rapport niet opnieuw", async () => {
    const purgedIds = await purgeExpiredReports();
    expect(purgedIds).not.toContain(expiredReportId);
  });
});
