import { describe, it, expect } from "vitest";
import { Document, Packer, Paragraph, HeadingLevel, ImageRun, TextRun, Table, TableRow, TableCell } from "docx";
import mammoth from "mammoth";
import JSZip from "jszip";
import { fillDocxTemplate, TemplateFillError } from "@/lib/docx/fillTemplate";
import type { FillTemplateChapter } from "@/lib/docx/fillTemplate";

// Piepklein rood 1x1-PNG-plaatje, dienst doend als "logo" in het testsjabloon.
const LOGO_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==",
  "base64",
);

async function buildTestTemplate(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new ImageRun({ type: "png", data: LOGO_PNG, transformation: { width: 40, height: 40 } })],
          }),
          new Paragraph({ children: [new TextRun("Gemeente Teststad — briefhoofdtekst")] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Aanleiding en vraagstelling" }),
          new Paragraph({ text: "TODO: vul hier de aanleiding in." }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Conclusie en vervolgadvies" }),
          new Paragraph({ text: "TODO: vul hier de conclusie in." }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function chapter(title: string, statementText = "Testbewering voor dit hoofdstuk."): FillTemplateChapter {
  return {
    title,
    status: "NIET_GECONTROLEERD",
    missingInfo: [],
    statements: [
      { id: "s1", text: statementText, category: "FEIT", sourceRefs: ["B1-1"], origin: "AI", sourceVerified: true },
    ],
  };
}

async function extractPlainText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

describe("fillDocxTemplate", () => {
  it("levert een geldig .docx-bestand op", async () => {
    const template = await buildTestTemplate();
    const buffer = await fillDocxTemplate(template, {
      chapters: [chapter("Aanleiding en vraagstelling"), chapter("Conclusie en vervolgadvies")],
      version: 1,
      generatedAt: new Date("2026-09-14T10:00:00Z"),
      addChecklist: false,
      addConceptFootnote: false,
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 4).toString("hex")).toBe("504b0304");
  });

  it("behoudt het logo (media-bestand) byte-voor-byte ongewijzigd", async () => {
    const template = await buildTestTemplate();
    const buffer = await fillDocxTemplate(template, {
      chapters: [chapter("Aanleiding en vraagstelling"), chapter("Conclusie en vervolgadvies")],
      version: 1,
      generatedAt: new Date(),
      addChecklist: false,
      addConceptFootnote: false,
    });

    const zip = await JSZip.loadAsync(buffer);
    const mediaFiles = Object.values(zip.files).filter((f) => !f.dir && f.name.startsWith("word/media/"));
    expect(mediaFiles.length).toBeGreaterThan(0);
    const imageBytes = await mediaFiles[0]!.async("nodebuffer");
    expect(imageBytes.equals(LOGO_PNG)).toBe(true);
  });

  it("behoudt briefhoofdtekst en kopteksten, en vervangt de placeholder-inhoud eronder", async () => {
    const template = await buildTestTemplate();
    const buffer = await fillDocxTemplate(template, {
      chapters: [
        chapter("Aanleiding en vraagstelling", "De school heeft een zorgmelding gedaan."),
        chapter("Conclusie en vervolgadvies", "Vervolgonderzoek wordt geadviseerd."),
      ],
      version: 1,
      generatedAt: new Date(),
      addChecklist: false,
      addConceptFootnote: false,
    });

    const text = await extractPlainText(buffer);
    expect(text).toContain("Gemeente Teststad — briefhoofdtekst");
    expect(text).toContain("Aanleiding en vraagstelling");
    expect(text).toContain("Conclusie en vervolgadvies");
    expect(text).toContain("De school heeft een zorgmelding gedaan.");
    expect(text).toContain("Vervolgonderzoek wordt geadviseerd.");
    expect(text).not.toContain("TODO: vul hier");
  });

  it("voegt een niet-gematchte hoofdstuktitel achteraan toe in plaats van de inhoud te laten verdwijnen", async () => {
    const template = await buildTestTemplate();
    const buffer = await fillDocxTemplate(template, {
      chapters: [
        chapter("Aanleiding en vraagstelling"),
        chapter("Conclusie en vervolgadvies"),
        chapter("Hoofdstuk dat niet in het sjabloon voorkomt", "Unieke inhoud die ergens moet verschijnen."),
      ],
      version: 1,
      generatedAt: new Date(),
      addChecklist: false,
      addConceptFootnote: false,
    });

    const text = await extractPlainText(buffer);
    expect(text).toContain("Hoofdstuk dat niet in het sjabloon voorkomt");
    expect(text).toContain("Unieke inhoud die ergens moet verschijnen.");
  });

  it("voegt de checklist en conceptmelding toe aan het einde wanneer gevraagd", async () => {
    const template = await buildTestTemplate();
    const buffer = await fillDocxTemplate(template, {
      chapters: [chapter("Aanleiding en vraagstelling"), chapter("Conclusie en vervolgadvies")],
      version: 3,
      generatedAt: new Date("2026-09-14T10:00:00Z"),
      addChecklist: true,
      addConceptFootnote: true,
    });

    const text = await extractPlainText(buffer);
    expect(text).toContain("Checklist hoofdstukstatus");
    expect(text).toContain("CONCEPT");
    expect(text).toContain("versie 3");
  });

  it("laat checklist en conceptmelding weg wanneer niet gevraagd", async () => {
    const template = await buildTestTemplate();
    const buffer = await fillDocxTemplate(template, {
      chapters: [chapter("Aanleiding en vraagstelling"), chapter("Conclusie en vervolgadvies")],
      version: 1,
      generatedAt: new Date(),
      addChecklist: false,
      addConceptFootnote: false,
    });

    const text = await extractPlainText(buffer);
    expect(text).not.toContain("Checklist hoofdstukstatus");
    expect(text).not.toContain("CONCEPT —");
  });

  it("gooit een TemplateFillError voor een ongeldig .docx-bestand", async () => {
    await expect(
      fillDocxTemplate(Buffer.from("dit is geen zip-bestand"), {
        chapters: [chapter("Iets")],
        version: 1,
        generatedAt: new Date(),
        addChecklist: false,
        addConceptFootnote: false,
      }),
    ).rejects.toBeInstanceOf(TemplateFillError);
  });

  it("gooit een TemplateFillError als het sjabloon geen kopstijlen heeft", async () => {
    const doc = new Document({
      sections: [{ children: [new Paragraph({ text: "Alleen platte tekst, geen koppen." })] }],
    });
    const buffer = await Packer.toBuffer(doc);

    await expect(
      fillDocxTemplate(buffer, {
        chapters: [chapter("Aanleiding en vraagstelling")],
        version: 1,
        generatedAt: new Date(),
        addChecklist: false,
        addConceptFootnote: false,
      }),
    ).rejects.toBeInstanceOf(TemplateFillError);
  });

  it("gooit een TemplateFillError als geen enkele hoofdstuktitel als kop teruggevonden wordt", async () => {
    const template = await buildTestTemplate();
    await expect(
      fillDocxTemplate(template, {
        chapters: [chapter("Compleet andere titel die nergens op slaat")],
        version: 1,
        generatedAt: new Date(),
        addChecklist: false,
        addConceptFootnote: false,
      }),
    ).rejects.toBeInstanceOf(TemplateFillError);
  });
});

// Sjablonen die géén echte Word-kopstijlen gebruiken, maar wel handmatig
// vetgedrukte titelregels — zie src/lib/docx/headingHeuristics.ts. Moet
// hetzelfde criterium hanteren als templateExtraction.ts, anders zou een bij
// upload herkend hoofdstuk hier niet meer terug te vinden zijn.
async function buildBoldOnlyTemplate(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new ImageRun({ type: "png", data: LOGO_PNG, transformation: { width: 40, height: 40 } })],
          }),
          new Paragraph({ children: [new TextRun("Gemeente Teststad — briefhoofdtekst")] }),
          new Paragraph({ children: [new TextRun({ text: "Aanleiding en vraagstelling", bold: true })] }),
          new Paragraph({ text: "TODO: vul hier de aanleiding in." }),
          new Paragraph({ children: [new TextRun({ text: "Conclusie en vervolgadvies", bold: true })] }),
          new Paragraph({ text: "TODO: vul hier de conclusie in." }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

describe("fillDocxTemplate — vetgedrukte-titel-fallback (sjabloon zonder kopstijlen)", () => {
  it("matcht en vult hoofdstukken op basis van volledig vetgedrukte titelregels", async () => {
    const template = await buildBoldOnlyTemplate();
    const buffer = await fillDocxTemplate(template, {
      chapters: [
        chapter("Aanleiding en vraagstelling", "De school heeft een zorgmelding gedaan."),
        chapter("Conclusie en vervolgadvies", "Vervolgonderzoek wordt geadviseerd."),
      ],
      version: 1,
      generatedAt: new Date(),
      addChecklist: false,
      addConceptFootnote: false,
    });

    const text = await extractPlainText(buffer);
    expect(text).toContain("Gemeente Teststad — briefhoofdtekst");
    expect(text).toContain("De school heeft een zorgmelding gedaan.");
    expect(text).toContain("Vervolgonderzoek wordt geadviseerd.");
    expect(text).not.toContain("TODO: vul hier");
  });

  it("behoudt het logo ook bij de vetgedrukte-titel-fallback", async () => {
    const template = await buildBoldOnlyTemplate();
    const buffer = await fillDocxTemplate(template, {
      chapters: [chapter("Aanleiding en vraagstelling"), chapter("Conclusie en vervolgadvies")],
      version: 1,
      generatedAt: new Date(),
      addChecklist: false,
      addConceptFootnote: false,
    });

    const zip = await JSZip.loadAsync(buffer);
    const mediaFiles = Object.values(zip.files).filter((f) => !f.dir && f.name.startsWith("word/media/"));
    expect(mediaFiles.length).toBeGreaterThan(0);
    const imageBytes = await mediaFiles[0]!.async("nodebuffer");
    expect(imageBytes.equals(LOGO_PNG)).toBe(true);
  });
});

describe("fillDocxTemplate — mengt de twee matchstrategieën nooit binnen één vulling", () => {
  it("negeert een incidenteel vetgedrukte paragraaf zodra er al Kop-stijl-matches zijn", async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Aanleiding en vraagstelling" }),
            new Paragraph({ children: [new TextRun({ text: "Let op", bold: true })] }),
            new Paragraph({ text: "TODO: vul hier de aanleiding in." }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Conclusie en vervolgadvies" }),
            new Paragraph({ text: "TODO: vul hier de conclusie in." }),
          ],
        },
      ],
    });
    const template = await Packer.toBuffer(doc);

    const buffer = await fillDocxTemplate(template, {
      chapters: [
        chapter("Aanleiding en vraagstelling", "Inhoud A."),
        chapter("Conclusie en vervolgadvies", "Inhoud B."),
      ],
      version: 1,
      generatedAt: new Date(),
      addChecklist: false,
      addConceptFootnote: false,
    });

    const text = await extractPlainText(buffer);
    // "Let op" is geen Kop-stijl-paragraaf: bij de (hier actieve) kopstijl-
    // strategie hoort die gewoon bij de vervangen sectie-inhoud, en wordt niet
    // apart als extra hoofdstukgrens opgevat.
    expect(text).not.toContain("Let op");
    expect(text).toContain("Inhoud A.");
    expect(text).toContain("Inhoud B.");
  });
});

// Nagebouwde structuur van een echt gemeentelijk intakeformulier
// ("Onderzoeksplan Jeugd"): een Kop 1-titel, een tabel met persoonsgegevens-
// invulvelden, een vetgedrukte sectietitel gevolgd door een tabelcel met
// meerdere vetgedrukte vragen, en tot slot losse (niet-tabel) checkbox-/
// handtekeningregels. Dit is precies het scenario waarvoor de
// tabel-veilige export (findSafeSectionEnd) gebouwd is: alleen de vragen in
// de tabelcel mogen ingevuld worden, de rest moet 100% ongewijzigd blijven.
async function buildIntakeFormTemplate(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Onderzoeksplan Test" }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Naam")] }),
                  new TableCell({ children: [new Paragraph("")] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("BSN")] }),
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
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph("Checkbox: akkoord ja/nee ____"),
          new Paragraph("Handtekening: ____________"),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function questionChapter(title: string, answerText: string): FillTemplateChapter {
  return {
    title,
    status: "COMPLEET",
    missingInfo: [],
    statements: [
      { id: "s1", text: answerText, category: "FEIT", sourceRefs: ["B1-1"], origin: "AI", sourceVerified: true },
    ],
  };
}

describe("fillDocxTemplate — tabel-veilig vullen (intakeformulier-achtig sjabloon)", () => {
  it("vult vetgedrukte vragen binnen een tabelcel, zonder de tabelstructuur te beschadigen", async () => {
    const template = await buildIntakeFormTemplate();
    const buffer = await fillDocxTemplate(template, {
      chapters: [
        questionChapter("Wat is de hulpvraag?", "UNIEKE_TEKST_VRAAG1"),
        questionChapter("Welke problemen worden er ondervonden?", "UNIEKE_TEKST_VRAAG2"),
      ],
      version: 1,
      generatedAt: new Date(),
      addChecklist: false,
      addConceptFootnote: false,
    });

    // Moet een geldig, leesbaar .docx-bestand blijven (geen kapotte
    // tabel-XML die JSZip/mammoth niet meer kan verwerken).
    const text = await extractPlainText(buffer);
    expect(text).toContain("UNIEKE_TEKST_VRAAG1");
    expect(text).toContain("UNIEKE_TEKST_VRAAG2");
  });

  it("laat persoonsgegevensvelden en checkbox-/handtekeningregels 100% ongewijzigd", async () => {
    const template = await buildIntakeFormTemplate();
    const buffer = await fillDocxTemplate(template, {
      chapters: [
        questionChapter("Wat is de hulpvraag?", "UNIEKE_TEKST_VRAAG1"),
        questionChapter("Welke problemen worden er ondervonden?", "UNIEKE_TEKST_VRAAG2"),
      ],
      version: 1,
      generatedAt: new Date(),
      addChecklist: false,
      addConceptFootnote: false,
    });

    const origZip = await JSZip.loadAsync(template);
    const outZip = await JSZip.loadAsync(buffer);
    const origXml = await origZip.file("word/document.xml")!.async("string");
    const outXml = await outZip.file("word/document.xml")!.async("string");

    // Alles vóór de vetgedrukte sectietitel (incl. de persoonsgegevens-
    // tabel) moet byte-voor-byte identiek blijven.
    const origBefore = origXml.slice(0, origXml.indexOf("Hulpvraag"));
    const outBefore = outXml.slice(0, outXml.indexOf("Hulpvraag"));
    expect(outBefore).toBe(origBefore);

    // Alles vanaf de checkbox-/handtekeningregel (buiten elke tabel) moet
    // ook byte-voor-byte identiek blijven — nooit overschreven, ook al is
    // er geen kop-grens meer ná de laatste ingevulde vraag.
    const origAfter = origXml.slice(origXml.indexOf("Checkbox"));
    const outAfter = outXml.slice(outXml.indexOf("Checkbox"));
    expect(outAfter).toBe(origAfter);
  });

  it("houdt het antwoord op een vraag binnen diens eigen tabelcel (lekt niet naar een andere cel)", async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "Vraag A?", bold: true })] }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "Vraag B?", bold: true })] }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    });
    const template = await Packer.toBuffer(doc);

    const buffer = await fillDocxTemplate(template, {
      chapters: [questionChapter("Vraag A?", "ANTWOORD_A"), questionChapter("Vraag B?", "ANTWOORD_B")],
      version: 1,
      generatedAt: new Date(),
      addChecklist: false,
      addConceptFootnote: false,
    });

    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");
    // ANTWOORD_A moet vóór "Vraag B?" staan (dus in cel A, niet in cel B).
    expect(xml.indexOf("ANTWOORD_A")).toBeLessThan(xml.indexOf("Vraag B?"));
    expect(xml.indexOf("ANTWOORD_B")).toBeGreaterThan(xml.indexOf("Vraag B?"));

    const text = await extractPlainText(buffer);
    expect(text).toContain("ANTWOORD_A");
    expect(text).toContain("ANTWOORD_B");
  });
});
