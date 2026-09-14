import { describe, it, expect } from "vitest";
import { Document, Packer, Paragraph, HeadingLevel, ImageRun, TextRun } from "docx";
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
