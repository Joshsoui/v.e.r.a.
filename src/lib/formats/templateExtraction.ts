// Zet een geüpload .docx-sjabloon om in een hoofdstukstructuur
// (ChapterDefinition[]) door de Word-kopstijlen (Kop 1/Kop 2/Kop 3) eruit te
// halen. Zo wordt het geüploade sjabloon zelf het format waarin de AI de
// brontekst structureert — inclusief alle zero-fabrication-waarborgen, want
// het resultaat is gewoon een normale FormatTemplate.chapters.

import mammoth from "mammoth";
import type { ChapterDefinition } from "@/lib/formats/types";

export type ExtractedHeading = { level: number; title: string };

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function extractHeadingsFromDocx(buffer: Buffer): Promise<ExtractedHeading[]> {
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;
  const headings: ExtractedHeading[] = [];
  const regex = /<h([1-3])[^>]*>(.*?)<\/h\1>/gis;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const levelRaw = match[1];
    const contentRaw = match[2];
    if (!levelRaw || contentRaw === undefined) continue;
    const level = Number(levelRaw);
    const title = decodeEntities(contentRaw.replace(/<[^>]+>/g, "")).trim();
    if (title.length > 0) headings.push({ level, title });
  }
  return headings;
}

function slugify(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "hoofdstuk"
  );
}

/**
 * Neemt alleen het hoogste kopniveau dat voorkomt (bv. enkel "Kop 1") als
 * hoofdstukken — zo worden sub-kopjes niet los als eigen hoofdstuk
 * behandeld. Bij dubbele titels wordt de key uniek gemaakt met een suffix.
 */
export function headingsToChapterDefinitions(headings: ExtractedHeading[]): ChapterDefinition[] {
  if (headings.length === 0) return [];
  const minLevel = Math.min(...headings.map((h) => h.level));
  const topLevel = headings.filter((h) => h.level === minLevel);

  const usedKeys = new Set<string>();
  return topLevel.map((h, index) => {
    let key = slugify(h.title);
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${slugify(h.title)}-${suffix}`;
      suffix += 1;
    }
    usedKeys.add(key);

    return {
      key,
      title: h.title,
      order: index,
      instructions: `Vul dit hoofdstuk ("${h.title}") met de informatie uit de brontekst die daarbij hoort.`,
      requiredElements: [],
    };
  });
}
