// Seed-script: vult de configuratietabellen (Discipline, DocumentType,
// FormatTemplate) voor de eerste concrete usecase — de jeugdconsulent,
// documenttype "Onderzoeksverslag". Idempotent: kan veilig meerdere keren
// gedraaid worden (upsert op unieke codes).

import { prisma } from "@/lib/db/prisma";
import type {
  ChapterDefinition,
  WritingStyleOption,
  FormatValidatorRules,
} from "@/lib/formats/types";

const chapters: ChapterDefinition[] = [
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
];

const writingStyles: WritingStyleOption[] = [
  {
    key: "zakelijk",
    label: "Zakelijk en formeel",
    description: "Formele, zakelijke schrijfstijl passend bij een officieel gemeentelijk document.",
  },
  {
    key: "toegankelijk",
    label: "Toegankelijk (B1)",
    description: "Eenvoudig en toegankelijk Nederlands (streefniveau B1), goed leesbaar voor cliënten.",
  },
  {
    key: "uitgebreid",
    label: "Uitgebreid onderbouwd",
    description:
      "Uitgebreide, gedetailleerde onderbouwing met nadruk op zorgvuldige weergave van alle nuances uit de bron.",
  },
];

const validatorRules: FormatValidatorRules = {
  aanleiding: {
    minStatements: 1,
    requiredCategories: ["FEIT"],
    requiredKeywords: [],
    forbidMissingInfo: true,
  },
  betrokkenen: {
    minStatements: 1,
    requiredCategories: [],
    requiredKeywords: [],
    forbidMissingInfo: true,
  },
  onderzoek: {
    minStatements: 2,
    requiredCategories: ["FEIT"],
    requiredKeywords: [],
    forbidMissingInfo: true,
  },
  kindgesprek: {
    minStatements: 1,
    requiredCategories: ["VERKLARING"],
    requiredKeywords: [],
    forbidMissingInfo: false,
  },
  analyse: {
    minStatements: 1,
    requiredCategories: ["PROFESSIONELE_DUIDING"],
    requiredKeywords: [],
    forbidMissingInfo: false,
  },
  conclusie: {
    minStatements: 1,
    requiredCategories: [],
    requiredKeywords: [],
    forbidMissingInfo: false,
  },
};

async function main() {
  const discipline = await prisma.discipline.upsert({
    where: { code: "jeugd" },
    update: { name: "Jeugd" },
    create: { code: "jeugd", name: "Jeugd" },
  });

  const documentType = await prisma.documentType.upsert({
    where: { disciplineId_code: { disciplineId: discipline.id, code: "onderzoeksverslag" } },
    update: {
      name: "Onderzoeksverslag",
      description: "Onderzoeksverslag jeugdconsulent naar aanleiding van een melding of signaal.",
    },
    create: {
      disciplineId: discipline.id,
      code: "onderzoeksverslag",
      name: "Onderzoeksverslag",
      description: "Onderzoeksverslag jeugdconsulent naar aanleiding van een melding of signaal.",
    },
  });

  const existingDefault = await prisma.formatTemplate.findFirst({
    where: { documentTypeId: documentType.id, isDefault: true },
  });

  if (existingDefault) {
    await prisma.formatTemplate.update({
      where: { id: existingDefault.id },
      data: {
        name: "Standaardformat Onderzoeksverslag Jeugd",
        municipality: null,
        chapters,
        writingStyles,
        validatorRules,
      },
    });
  } else {
    await prisma.formatTemplate.create({
      data: {
        documentTypeId: documentType.id,
        name: "Standaardformat Onderzoeksverslag Jeugd",
        municipality: null,
        isDefault: true,
        chapters,
        writingStyles,
        validatorRules,
      },
    });
  }

  console.log("Seed voltooid: vakgebied 'Jeugd' → documenttype 'Onderzoeksverslag' → standaardformat.");
}

main()
  .catch((err) => {
    console.error("Seed mislukt:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
