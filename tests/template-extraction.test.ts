import { describe, it, expect } from "vitest";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import {
  extractHeadingsFromDocx,
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
