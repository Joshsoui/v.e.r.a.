// Zet een geüpload .docx-sjabloon om in een hoofdstukstructuur
// (ChapterDefinition[]) door de Word-kopstijlen (Kop 1/Kop 2/Kop 3) eruit te
// halen. Zo wordt het geüploade sjabloon zelf het format waarin de AI de
// brontekst structureert — inclusief alle zero-fabrication-waarborgen, want
// het resultaat is gewoon een normale FormatTemplate.chapters.

import mammoth from "mammoth";
import type { ChapterDefinition } from "@/lib/formats/types";
import { looksLikeHeadingText } from "@/lib/docx/headingHeuristics";

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

/**
 * Fallback voor sjablonen zonder echte Word-kopstijlen: sommige gemeentelijke
 * sjablonen gebruiken alleen handmatig vetgedrukte tekst als "titel". Een
 * paragraaf die volledig (en alleen) uit vetgedrukte tekst bestaat en er qua
 * lengte/vorm als een titel uitziet (looksLikeHeadingText), tellen we als
 * hoofdstuktitel. Dit criterium moet identiek zijn aan wat fillTemplate.ts
 * bij export gebruikt om diezelfde titels terug te vinden — zie
 * src/lib/docx/headingHeuristics.ts.
 */
export async function extractBoldParagraphHeadings(buffer: Buffer): Promise<ExtractedHeading[]> {
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;
  const headings: ExtractedHeading[] = [];
  const paraRegex = /<p[^>]*>(.*?)<\/p>/gis;
  let match: RegExpExecArray | null;
  while ((match = paraRegex.exec(html)) !== null) {
    const inner = match[1];
    if (inner === undefined) continue;
    const boldMatch = /^\s*<strong>(.*?)<\/strong>\s*$/is.exec(inner);
    if (!boldMatch) continue;
    const boldContent = boldMatch[1];
    if (boldContent === undefined) continue;
    // Sla over als er binnen de vetgedrukte tekst nog andere opmaak-tags
    // zitten die niet puur tekstueel zijn (bv. een afbeelding).
    if (/<(?!\/?em>|\/?strong>)[a-z]/i.test(boldContent)) continue;
    const title = decodeEntities(boldContent.replace(/<[^>]+>/g, "")).trim();
    if (title.length > 0 && looksLikeHeadingText(title)) {
      headings.push({ level: 1, title });
    }
  }
  return headings;
}

/**
 * Probeert eerst echte Word-kopstijlen; valt terug op vetgedrukte paragrafen
 * als dat te weinig oplevert om een bruikbare hoofdstukstructuur te vormen.
 *
 * Belangrijk: "te weinig oplevert" wordt beoordeeld op het aantal
 * BRUIKBARE (top-niveau) hoofdstukken ná headingsToChapterDefinitions(), niet
 * op het ruwe aantal gevonden koppen. Een document kan best 6 Word-koppen
 * hebben (1x Kop 1 als documenttitel, 5x Kop 2 als sectiekopjes van een
 * formulier) en daarmee toch maar 1 bruikbaar top-niveau-hoofdstuk opleveren
 * (alleen de titel) — precies het scenario bij een intakeformulier waarvan de
 * eigenlijke invulbare vragen niet in Kop-stijl staan, maar handmatig
 * vetgedrukt zijn (vaak binnen een tabelcel). Zie fillTemplate.ts voor hoe
 * zo'n in-tabelcel-kop bij export veilig (zonder de tabel te beschadigen)
 * ingevuld wordt.
 */
export async function extractHeadingsFromDocxWithFallback(
  buffer: Buffer,
): Promise<{ headings: ExtractedHeading[]; usedFallback: boolean }> {
  const realHeadings = await extractHeadingsFromDocx(buffer);
  const realChapterCount = headingsToChapterDefinitions(realHeadings).length;
  if (realChapterCount >= 2) {
    return { headings: realHeadings, usedFallback: false };
  }
  const boldHeadings = await extractBoldParagraphHeadings(buffer);
  if (boldHeadings.length >= 2) {
    return { headings: boldHeadings, usedFallback: true };
  }
  return { headings: realHeadings, usedFallback: false };
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
