import { describe, it, expect } from "vitest";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell } from "docx";
import {
  extractHeadingsFromDocx,
  extractHeadingsFromDocxWithFallback,
  headingsToChapterDefinitions,
} from "@/lib/formats/templateExtraction";

async function buildTestDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Aanleiding" }),
          new Paragraph({ text: "Wat losse tekst onder het eerste kopje." }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Onderzoek" }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Sub-kopje (moet genegeerd worden)" }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Conclusie" }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

describe("extractHeadingsFromDocx", () => {
  it("haalt de Word-koppen er in volgorde uit, met hun niveau", async () => {
    const buffer = await buildTestDocx();
    const headings = await extractHeadingsFromDocx(buffer);

    const level1Titles = headings.filter((h) => h.level === 1).map((h) => h.title);
    expect(level1Titles).toEqual(["Aanleiding", "Onderzoek", "Conclusie"]);
    expect(headings.some((h) => h.level === 2 && h.title.includes("Sub-kopje"))).toBe(true);
  });

  it("geeft een lege lijst voor een document zonder kopstijlen", async () => {
    const doc = new Document({
      sections: [{ children: [new Paragraph({ text: "Alleen platte tekst, geen koppen." })] }],
    });
    const buffer = await Packer.toBuffer(doc);
    const headings = await extractHeadingsFromDocx(buffer);
    expect(headings).toHaveLength(0);
  });
});

async function buildBoldOnlyTestDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: "Aanleiding", bold: true })] }),
          new Paragraph({ text: "Wat losse tekst onder het eerste kopje." }),
          new Paragraph({ children: [new TextRun({ text: "Onderzoek", bold: true })] }),
          new Paragraph({ text: "Nog een stukje tekst." }),
          new Paragraph({ children: [new TextRun({ text: "Conclusie", bold: true })] }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

describe("extractHeadingsFromDocxWithFallback", () => {
  it("gebruikt echte kopstijlen als die er zijn en meldt geen fallback", async () => {
    const buffer = await buildTestDocx();
    const { headings, usedFallback } = await extractHeadingsFromDocxWithFallback(buffer);
    expect(usedFallback).toBe(false);
    expect(headings.filter((h) => h.level === 1).map((h) => h.title)).toEqual([
      "Aanleiding",
      "Onderzoek",
      "Conclusie",
    ]);
  });

  it("valt terug op volledig vetgedrukte titelregels als het sjabloon geen kopstijlen heeft", async () => {
    const buffer = await buildBoldOnlyTestDocx();
    const { headings, usedFallback } = await extractHeadingsFromDocxWithFallback(buffer);
    expect(usedFallback).toBe(true);
    expect(headings.map((h) => h.title)).toEqual(["Aanleiding", "Onderzoek", "Conclusie"]);
  });

  it("geeft een lege lijst zonder fallback als er ook geen bruikbare vetgedrukte titels zijn", async () => {
    const doc = new Document({
      sections: [{ children: [new Paragraph({ text: "Alleen platte tekst, niet vet, geen koppen." })] }],
    });
    const buffer = await Packer.toBuffer(doc);
    const { headings, usedFallback } = await extractHeadingsFromDocxWithFallback(buffer);
    expect(usedFallback).toBe(false);
    expect(headings).toHaveLength(0);
  });
});

describe("headingsToChapterDefinitions", () => {
  it("gebruikt alleen het hoogste kopniveau (negeert sub-kopjes)", () => {
    const chapters = headingsToChapterDefinitions([
      { level: 1, title: "Aanleiding" },
      { level: 1, title: "Onderzoek" },
      { level: 2, title: "Dit is een sub-kopje" },
      { level: 1, title: "Conclusie" },
    ]);
    expect(chapters.map((c) => c.title)).toEqual(["Aanleiding", "Onderzoek", "Conclusie"]);
    expect(chapters.map((c) => c.order)).toEqual([0, 1, 2]);
  });

  it("genereert unieke, geslugifyde keys, ook bij dubbele titels", () => {
    const chapters = headingsToChapterDefinitions([
      { level: 1, title: "Conclusie" },
      { level: 1, title: "Conclusie" },
    ]);
    const keys = chapters.map((c) => c.key);
    expect(new Set(keys).size).toBe(2);
    expect(keys[0]).toBe("conclusie");
    expect(keys[1]).not.toBe("conclusie");
  });

  it("geeft een lege lijst als er geen koppen zijn", () => {
    expect(headingsToChapterDefinitions([])).toEqual([]);
  });

  it("elk hoofdstuk krijgt een niet-lege instructie en een leeg requiredElements-array", () => {
    const chapters = headingsToChapterDefinitions([{ level: 1, title: "Financiën" }]);
    expect(chapters[0]?.instructions.length).toBeGreaterThan(0);
    expect(chapters[0]?.requiredElements).toEqual([]);
  });
});

// Nagebouwde structuur van een echt gemeentelijk intakeformulier
// ("Onderzoeksplan Jeugd"): een Kop 1-titel en een aantal Kop 2-secties die
// alleen tabellen met invulvelden bevatten (geen doorlopende tekst), plus een
// los, vetgedrukt vraagblok met de eigenlijke invulbare vragen in een
// tabelcel. Dit is precies het scenario dat de "te weinig bruikbare
// hoofdstukken"-fallback moet herkennen: er zijn best 4 echte Word-koppen
// (>=2!), maar die leveren via het top-niveau maar 1 hoofdstuk op (alleen de
// titel) — dus moet alsnog op de vetgedrukte vragen worden teruggevallen.
async function buildIntakeFormLikeDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Onderzoeksplan Test" }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Aanmelding" }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Naam consulent")] }),
                  new TableCell({ children: [new Paragraph("")] }),
                ],
              }),
            ],
          }),
          new Paragraph({ children: [new TextRun({ text: "Hulpvraag & advies", bold: true })] }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Wat is de hulpvraag?", bold: true })] }),
                      new Paragraph({
                        children: [new TextRun({ text: "Welke problemen worden er ondervonden?", bold: true })],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Kunnen de problemen opgelost worden door:", bold: true }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ children: [new TextRun({ text: "(Alleen indien van toepassing bij bezwaar)", bold: true })] }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Verklaring" }),
          new Paragraph("Checkbox: akkoord ja/nee ____"),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

describe("extractHeadingsFromDocxWithFallback — intakeformulier-achtig sjabloon", () => {
  it("valt terug op vetgedrukte vragen als de echte koppen maar 1 bruikbaar top-niveau-hoofdstuk opleveren", async () => {
    const buffer = await buildIntakeFormLikeDocx();
    const { headings, usedFallback } = await extractHeadingsFromDocxWithFallback(buffer);
    expect(usedFallback).toBe(true);

    const chapters = headingsToChapterDefinitions(headings);
    expect(chapters.map((c) => c.title)).toEqual([
      "Hulpvraag & advies",
      "Wat is de hulpvraag?",
      "Welke problemen worden er ondervonden?",
      "Kunnen de problemen opgelost worden door:",
    ]);
  });

  it("neemt een tussen haakjes geplaatste kanttekening niet op als hoofdstuk", async () => {
    const buffer = await buildIntakeFormLikeDocx();
    const { headings } = await extractHeadingsFromDocxWithFallback(buffer);
    expect(headings.some((h) => h.title.includes("Alleen indien van toepassing bij bezwaar"))).toBe(false);
  });

  it("neemt de echte Kop 2-secties (Aanmelding, Verklaring) niet op als hoofdstuk", async () => {
    const buffer = await buildIntakeFormLikeDocx();
    const { headings } = await extractHeadingsFromDocxWithFallback(buffer);
    expect(headings.some((h) => h.title === "Aanmelding")).toBe(false);
    expect(headings.some((h) => h.title === "Verklaring")).toBe(false);
  });
});
