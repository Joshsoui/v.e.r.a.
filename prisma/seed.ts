// Seed-script: vult de configuratietabellen (Discipline, DocumentType,
// FormatTemplate) voor de ondersteunde vakgebieden. Idempotent: kan veilig
// meerdere keren gedraaid worden (upsert op unieke codes).
//
// Nieuw vakgebied toevoegen = een nieuw object aan `domains` hieronder, geen
// wijziging elders in de applicatie (zie ook src/lib/formats/types.ts).

import { prisma } from "@/lib/db/prisma";
import type { ChapterDefinition, FormatValidatorRules } from "@/lib/formats/types";
import { defaultWritingStyles } from "@/lib/formats/defaults";

type DomainSeed = {
  disciplineCode: string;
  disciplineName: string;
  documentTypeCode: string;
  documentTypeName: string;
  documentTypeDescription: string;
  formatName: string;
  chapters: ChapterDefinition[];
  validatorRules: FormatValidatorRules;
};

const domains: DomainSeed[] = [
  {
    disciplineCode: "jeugd",
    disciplineName: "Jeugd",
    documentTypeCode: "onderzoeksverslag",
    documentTypeName: "Onderzoeksverslag",
    documentTypeDescription: "Onderzoeksverslag jeugdconsulent naar aanleiding van een melding of signaal.",
    formatName: "Standaardformat Onderzoeksverslag Jeugd",
    chapters: [
      {
        key: "aanleiding",
        title: "Aanleiding en vraagstelling",
        order: 0,
        instructions:
          "Beschrijf waarom dit onderzoek is gestart: de melding, het signaal of de vraag die aanleiding gaf, en om welke jeugdige het gaat (naam, leeftijd, school/omgeving voor zover vermeld in de bron).",
        requiredElements: ["Aanleiding of melding", "Betrokken jeugdige", "Onderzoeksvraag"],
      },
      {
        key: "betrokkenen",
        title: "Betrokkenen en netwerk",
        order: 1,
        instructions:
          "Beschrijf wie er bij het gezin/de jeugdige betrokken zijn: ouders/verzorgers, school, huisarts, netwerk, en welk contact daarmee is geweest volgens de bron.",
        requiredElements: ["Ouders/verzorgers", "School of andere professionals"],
      },
      {
        key: "onderzoek",
        title: "Onderzoek en bevindingen",
        order: 2,
        instructions:
          "Beschrijf de feitelijke bevindingen uit gesprekken, observaties en informatie van derden (school, huisarts, netwerk). Onderscheid nadrukkelijk feiten van verklaringen van betrokkenen.",
        requiredElements: ["Gespreksbevindingen", "Signalen of observaties"],
      },
      {
        key: "kindgesprek",
        title: "Gesprek met de jeugdige",
        order: 3,
        instructions:
          "Beschrijf wat er uit het gesprek met de jeugdige zelf naar voren is gekomen, leeftijdsadequaat en in de kernbewoording van de bron weergegeven.",
        requiredElements: ["Standpunt of beleving van de jeugdige"],
      },
      {
        key: "analyse",
        title: "Analyse en professionele duiding",
        order: 4,
        instructions:
          "Geef de professionele duiding/analyse weer zoals die in de brontekst door de jeugdconsulent is vastgelegd. Verzin zelf geen nieuwe analyse — gebruik uitsluitend wat in de bron als professionele inschatting is opgeschreven.",
        requiredElements: ["Professionele inschatting"],
      },
      {
        key: "conclusie",
        title: "Conclusie en vervolgadvies",
        order: 5,
        instructions:
          "Vat samen tot welke conclusie en welk vervolgadvies de bron leidt, uitsluitend voor zover dat expliciet in de bron is vastgelegd.",
        requiredElements: ["Conclusie", "Vervolgadvies"],
      },
    ],
    validatorRules: {
      aanleiding: { minStatements: 1, requiredCategories: ["FEIT"], requiredKeywords: [], forbidMissingInfo: true },
      betrokkenen: { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: true },
      onderzoek: { minStatements: 2, requiredCategories: ["FEIT"], requiredKeywords: [], forbidMissingInfo: true },
      kindgesprek: { minStatements: 1, requiredCategories: ["VERKLARING"], requiredKeywords: [], forbidMissingInfo: false },
      analyse: { minStatements: 1, requiredCategories: ["PROFESSIONELE_DUIDING"], requiredKeywords: [], forbidMissingInfo: false },
      conclusie: { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: false },
    },
  },
  {
    disciplineCode: "wmo",
    disciplineName: "Wmo",
    documentTypeCode: "onderzoeksverslag-wmo",
    documentTypeName: "Onderzoeksverslag Wmo-melding",
    documentTypeDescription: "Onderzoeksverslag naar aanleiding van een melding in het kader van de Wmo.",
    formatName: "Standaardformat Onderzoeksverslag Wmo",
    chapters: [
      {
        key: "aanleiding",
        title: "Aanleiding en melding",
        order: 0,
        instructions:
          "Beschrijf de aanleiding voor dit onderzoek: de Wmo-melding of hulpvraag, en om wie het gaat (voor zover vermeld in de bron).",
        requiredElements: ["Aanleiding of melding", "Hulpvraag"],
      },
      {
        key: "betrokkenen",
        title: "Betrokkenen en netwerk",
        order: 1,
        instructions:
          "Beschrijf welke mantelzorgers, netwerkleden en andere hulpverleners betrokken zijn en welk contact daarmee is geweest volgens de bron.",
        requiredElements: ["Mantelzorger of netwerk", "Andere hulpverleners"],
      },
      {
        key: "onderzoek",
        title: "Onderzoek: zelfredzaamheid en beperkingen",
        order: 2,
        instructions:
          "Beschrijf de feitelijke bevindingen over het huishouden, de beperkingen en de zelfredzaamheid van de cliënt uit gesprekken en observaties. Onderscheid feiten van verklaringen.",
        requiredElements: ["Beperkingen of ondersteuningsbehoefte", "Zelfredzaamheid"],
      },
      {
        key: "gesprek",
        title: "Gesprek met cliënt",
        order: 3,
        instructions:
          "Beschrijf wat er uit het (keukentafel)gesprek met de cliënt zelf naar voren is gekomen: eigen ervaring, wensen en doelen.",
        requiredElements: ["Wensen of doelen van de cliënt"],
      },
      {
        key: "analyse",
        title: "Analyse en professionele duiding",
        order: 4,
        instructions:
          "Geef de professionele duiding/analyse weer zoals die in de brontekst is vastgelegd. Verzin geen nieuwe analyse — gebruik uitsluitend wat in de bron staat.",
        requiredElements: ["Professionele inschatting"],
      },
      {
        key: "conclusie",
        title: "Conclusie en advies maatwerkvoorziening",
        order: 5,
        instructions:
          "Vat samen tot welke conclusie en welk advies (bv. maatwerkvoorziening) de bron leidt, uitsluitend voor zover expliciet vastgelegd.",
        requiredElements: ["Conclusie", "Advies"],
      },
    ],
    validatorRules: {
      aanleiding: { minStatements: 1, requiredCategories: ["FEIT"], requiredKeywords: [], forbidMissingInfo: true },
      betrokkenen: { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: true },
      onderzoek: { minStatements: 2, requiredCategories: ["FEIT"], requiredKeywords: [], forbidMissingInfo: true },
      gesprek: { minStatements: 1, requiredCategories: ["VERKLARING"], requiredKeywords: [], forbidMissingInfo: false },
      analyse: { minStatements: 1, requiredCategories: ["PROFESSIONELE_DUIDING"], requiredKeywords: [], forbidMissingInfo: false },
      conclusie: { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: false },
    },
  },
  {
    disciplineCode: "participatie",
    disciplineName: "Participatie",
    documentTypeCode: "re-integratieonderzoek",
    documentTypeName: "Re-integratieonderzoek",
    documentTypeDescription: "Onderzoeksverslag naar arbeids-/re-integratiemogelijkheden in het kader van de Participatiewet.",
    formatName: "Standaardformat Re-integratieonderzoek",
    chapters: [
      {
        key: "aanleiding",
        title: "Aanleiding en arbeidsmarktpositie",
        order: 0,
        instructions:
          "Beschrijf de aanleiding voor dit onderzoek en de huidige arbeidsmarktpositie van de cliënt, voor zover vermeld in de bron.",
        requiredElements: ["Aanleiding", "Huidige situatie"],
      },
      {
        key: "betrokkenen",
        title: "Betrokkenen",
        order: 1,
        instructions:
          "Beschrijf welke partijen betrokken zijn (werkgever, UWV, netwerk, andere hulpverleners) en welk contact daarmee is geweest volgens de bron.",
        requiredElements: ["Betrokken partijen"],
      },
      {
        key: "onderzoek",
        title: "Onderzoek: vaardigheden en belemmeringen",
        order: 2,
        instructions:
          "Beschrijf de feitelijke bevindingen over werkervaring, vaardigheden en eventuele belemmeringen (bv. gezondheid, mobiliteit) uit gesprekken en documentatie.",
        requiredElements: ["Werkervaring of vaardigheden", "Belemmeringen"],
      },
      {
        key: "gesprek",
        title: "Gesprek met cliënt",
        order: 3,
        instructions: "Beschrijf wat er uit het gesprek met de cliënt zelf naar voren is gekomen: eigen wensen en motivatie.",
        requiredElements: ["Wensen of motivatie van de cliënt"],
      },
      {
        key: "analyse",
        title: "Analyse en professionele duiding",
        order: 4,
        instructions:
          "Geef de professionele duiding/analyse weer zoals die in de brontekst is vastgelegd. Verzin geen nieuwe analyse.",
        requiredElements: ["Professionele inschatting"],
      },
      {
        key: "conclusie",
        title: "Conclusie en re-integratieadvies",
        order: 5,
        instructions: "Vat samen tot welke conclusie en welk re-integratieadvies de bron leidt.",
        requiredElements: ["Conclusie", "Advies"],
      },
    ],
    validatorRules: {
      aanleiding: { minStatements: 1, requiredCategories: ["FEIT"], requiredKeywords: [], forbidMissingInfo: true },
      betrokkenen: { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: true },
      onderzoek: { minStatements: 2, requiredCategories: ["FEIT"], requiredKeywords: [], forbidMissingInfo: true },
      gesprek: { minStatements: 1, requiredCategories: ["VERKLARING"], requiredKeywords: [], forbidMissingInfo: false },
      analyse: { minStatements: 1, requiredCategories: ["PROFESSIONELE_DUIDING"], requiredKeywords: [], forbidMissingInfo: false },
      conclusie: { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: false },
    },
  },
  {
    disciplineCode: "schuldhulpverlening",
    disciplineName: "Schuldhulpverlening",
    documentTypeCode: "intakeverslag",
    documentTypeName: "Intakeverslag schuldhulpverlening",
    documentTypeDescription: "Intakeverslag naar aanleiding van een aanmelding voor schuldhulpverlening.",
    formatName: "Standaardformat Intakeverslag Schuldhulpverlening",
    chapters: [
      {
        key: "aanleiding",
        title: "Aanleiding en hulpvraag",
        order: 0,
        instructions: "Beschrijf de aanleiding voor de aanmelding en de hulpvraag van de cliënt, voor zover vermeld in de bron.",
        requiredElements: ["Aanleiding", "Hulpvraag"],
      },
      {
        key: "financieel",
        title: "Financiële situatie",
        order: 1,
        instructions:
          "Beschrijf de feitelijke financiële situatie: inkomsten, schulden en vaste lasten, uitsluitend zoals vermeld in de bron.",
        requiredElements: ["Inkomsten", "Schulden of vaste lasten"],
      },
      {
        key: "betrokkenen",
        title: "Betrokkenen en netwerk",
        order: 2,
        instructions: "Beschrijf welke betrokkenen/netwerkleden een rol spelen en welk contact daarmee is geweest.",
        requiredElements: ["Betrokkenen"],
      },
      {
        key: "gesprek",
        title: "Gesprek met cliënt",
        order: 3,
        instructions: "Beschrijf wat er uit het gesprek met de cliënt zelf naar voren is gekomen.",
        requiredElements: ["Standpunt van de cliënt"],
      },
      {
        key: "analyse",
        title: "Analyse en professionele duiding",
        order: 4,
        instructions:
          "Geef de professionele duiding/analyse weer zoals die in de brontekst is vastgelegd. Verzin geen nieuwe analyse.",
        requiredElements: ["Professionele inschatting"],
      },
      {
        key: "conclusie",
        title: "Conclusie en vervolgtraject",
        order: 5,
        instructions: "Vat samen tot welke conclusie en welk vervolgtraject de bron leidt.",
        requiredElements: ["Conclusie", "Vervolgtraject"],
      },
    ],
    validatorRules: {
      aanleiding: { minStatements: 1, requiredCategories: ["FEIT"], requiredKeywords: [], forbidMissingInfo: true },
      financieel: { minStatements: 1, requiredCategories: ["FEIT"], requiredKeywords: [], forbidMissingInfo: true },
      betrokkenen: { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: false },
      gesprek: { minStatements: 1, requiredCategories: ["VERKLARING"], requiredKeywords: [], forbidMissingInfo: false },
      analyse: { minStatements: 1, requiredCategories: ["PROFESSIONELE_DUIDING"], requiredKeywords: [], forbidMissingInfo: false },
      conclusie: { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: false },
    },
  },
  {
    disciplineCode: "leerplicht",
    disciplineName: "Leerplicht",
    documentTypeCode: "verzuimonderzoeksverslag",
    documentTypeName: "Verzuimonderzoeksverslag",
    documentTypeDescription: "Onderzoeksverslag naar aanleiding van een verzuimmelding door een leerplichtambtenaar.",
    formatName: "Standaardformat Verzuimonderzoeksverslag",
    chapters: [
      {
        key: "aanleiding",
        title: "Aanleiding en verzuimmelding",
        order: 0,
        instructions:
          "Beschrijf de verzuimmelding: om welke jeugdige en school het gaat en wat de aanleiding was, voor zover vermeld in de bron.",
        requiredElements: ["Verzuimmelding", "Betrokken jeugdige en school"],
      },
      {
        key: "betrokkenen",
        title: "Betrokkenen",
        order: 1,
        instructions: "Beschrijf welke betrokkenen (school, ouders, jeugdige, andere hulpverleners) een rol spelen.",
        requiredElements: ["School", "Ouders"],
      },
      {
        key: "onderzoek",
        title: "Onderzoek naar verzuimoorzaak",
        order: 2,
        instructions:
          "Beschrijf de feitelijke bevindingen over de oorzaak van het verzuim uit gesprekken en informatie van school/ouders.",
        requiredElements: ["Signalen of oorzaken van verzuim"],
      },
      {
        key: "gesprek",
        title: "Gesprek met de jeugdige/ouders",
        order: 3,
        instructions: "Beschrijf wat er uit het gesprek met de jeugdige en/of de ouders zelf naar voren is gekomen.",
        requiredElements: ["Standpunt van jeugdige of ouders"],
      },
      {
        key: "analyse",
        title: "Analyse en professionele duiding",
        order: 4,
        instructions:
          "Geef de professionele duiding/analyse weer zoals die in de brontekst is vastgelegd. Verzin geen nieuwe analyse.",
        requiredElements: ["Professionele inschatting"],
      },
      {
        key: "conclusie",
        title: "Conclusie en vervolgadvies",
        order: 5,
        instructions: "Vat samen tot welke conclusie en welk vervolgadvies de bron leidt.",
        requiredElements: ["Conclusie", "Vervolgadvies"],
      },
    ],
    validatorRules: {
      aanleiding: { minStatements: 1, requiredCategories: ["FEIT"], requiredKeywords: [], forbidMissingInfo: true },
      betrokkenen: { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: true },
      onderzoek: { minStatements: 2, requiredCategories: ["FEIT"], requiredKeywords: [], forbidMissingInfo: true },
      gesprek: { minStatements: 1, requiredCategories: ["VERKLARING"], requiredKeywords: [], forbidMissingInfo: false },
      analyse: { minStatements: 1, requiredCategories: ["PROFESSIONELE_DUIDING"], requiredKeywords: [], forbidMissingInfo: false },
      conclusie: { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: false },
    },
  },
];

async function seedDomain(domain: DomainSeed) {
  const discipline = await prisma.discipline.upsert({
    where: { code: domain.disciplineCode },
    update: { name: domain.disciplineName },
    create: { code: domain.disciplineCode, name: domain.disciplineName },
  });

  const documentType = await prisma.documentType.upsert({
    where: { disciplineId_code: { disciplineId: discipline.id, code: domain.documentTypeCode } },
    update: { name: domain.documentTypeName, description: domain.documentTypeDescription },
    create: {
      disciplineId: discipline.id,
      code: domain.documentTypeCode,
      name: domain.documentTypeName,
      description: domain.documentTypeDescription,
    },
  });

  const existingDefault = await prisma.formatTemplate.findFirst({
    where: { documentTypeId: documentType.id, isDefault: true, organizationId: null },
  });

  if (existingDefault) {
    await prisma.formatTemplate.update({
      where: { id: existingDefault.id },
      data: {
        name: domain.formatName,
        municipality: null,
        chapters: domain.chapters,
        writingStyles: defaultWritingStyles,
        validatorRules: domain.validatorRules,
      },
    });
  } else {
    await prisma.formatTemplate.create({
      data: {
        documentTypeId: documentType.id,
        name: domain.formatName,
        municipality: null,
        isDefault: true,
        organizationId: null,
        chapters: domain.chapters,
        writingStyles: defaultWritingStyles,
        validatorRules: domain.validatorRules,
      },
    });
  }

  console.log(`  → ${domain.disciplineName} → ${domain.documentTypeName} → ${domain.formatName}`);
}

async function main() {
  console.log("Seed gestart voor", domains.length, "vakgebied(en):");
  for (const domain of domains) {
    await seedDomain(domain);
  }
  console.log("Seed voltooid.");
}

main()
  .catch((err) => {
    console.error("Seed mislukt:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
