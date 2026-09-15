// Vult een écht geüpload .docx-sjabloon (met het eigen logo/huisstijl/opmaak
// van de organisatie) met de gegenereerde hoofdstukinhoud, in plaats van een
// generiek document te genereren (zie src/lib/docx/export.ts, dat wél de
// fallback blijft voor gedeelde/geseede formats zonder eigen sjabloon).
//
// Een .docx-bestand is een zip met XML. We raken UITSLUITEND word/document.xml
// aan: koppen/logo's/lettertypen/paginamarges/headers/footers/media leven in
// andere delen van het archief (word/styles.xml, word/header*.xml,
// word/media/*, enz.) en blijven ongewijzigd. Per herkend hoofdstuk zoeken we
// de bijbehorende kopparagraaf (gematcht op tekst, alleen onder paragrafen
// met een echte Kop 1/2/3-stijl) en vervangen we alles tussen die kop en de
// eerstvolgende kop door de gegenereerde inhoud.

import JSZip from "jszip";
import type { PersistedStatement } from "@/lib/reports/types";
import type { ChapterStatusValue } from "@/lib/validators";
import { looksLikeHeadingText } from "@/lib/docx/headingHeuristics";

const CATEGORY_LABELS: Record<PersistedStatement["category"], string> = {
  FEIT: "feit",
  VERKLARING: "verklaring van betrokkene",
  PROFESSIONELE_DUIDING: "professionele duiding",
};

const STATUS_LABELS: Record<ChapterStatusValue, string> = {
  COMPLEET: "Compleet",
  ONVOLLEDIG: "Onvolledig",
  NIET_GECONTROLEERD: "Nog niet gecontroleerd",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export class TemplateFillError extends Error {}

export type FillTemplateChapter = {
  title: string;
  statements: PersistedStatement[];
  missingInfo: string[];
  status: ChapterStatusValue;
};

export type FillTemplateInput = {
  chapters: FillTemplateChapter[];
  version: number;
  generatedAt: Date;
  addChecklist: boolean;
  addConceptFootnote: boolean;
};

// ---------------------------------------------------------------------------
// Lage-niveau XML-hulpfuncties
// ---------------------------------------------------------------------------

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function extractParagraphText(paragraphXml: string): string {
  const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let text = "";
  let match: RegExpExecArray | null;
  while ((match = regex.exec(paragraphXml)) !== null) {
    text += decodeXmlEntities(match[1] ?? "");
  }
  return text.trim();
}

/** Zoekt in word/styles.xml de style-id's van de ingebouwde "heading 1/2/3"-stijlen. */
function findHeadingStyleIds(stylesXml: string): Map<number, string> {
  const result = new Map<number, string>();
  const styleBlockRegex = /<w:style\b[^>]*\bw:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g;
  let match: RegExpExecArray | null;
  while ((match = styleBlockRegex.exec(stylesXml)) !== null) {
    const styleId = match[1];
    const inner = match[2];
    if (!styleId || !inner) continue;
    const nameMatch = /<w:name\s+w:val="([^"]+)"/i.exec(inner);
    if (!nameMatch?.[1]) continue;
    const headingMatch = /^heading\s*([1-3])$/i.exec(nameMatch[1].trim());
    if (headingMatch?.[1] && !result.has(Number(headingMatch[1]))) {
      result.set(Number(headingMatch[1]), styleId);
    }
  }
  return result;
}

function normalizeHeadingText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

type RunOptions = { bold?: boolean; italics?: boolean; color?: string; sizeHalfPoints?: number };

function buildRun(text: string, opts: RunOptions = {}): string {
  const rPrParts: string[] = [];
  if (opts.bold) rPrParts.push("<w:b/>");
  if (opts.italics) rPrParts.push("<w:i/>");
  if (opts.color) rPrParts.push(`<w:color w:val="${opts.color}"/>`);
  if (opts.sizeHalfPoints) rPrParts.push(`<w:sz w:val="${opts.sizeHalfPoints}"/><w:szCs w:val="${opts.sizeHalfPoints}"/>`);
  const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : "";

  return text
    .split("\n")
    .map((line, i) => {
      const br = i > 0 ? "<w:br/>" : "";
      return `<w:r>${rPr}${br}<w:t xml:space="preserve">${escapeXmlText(line)}</w:t></w:r>`;
    })
    .join("");
}

function buildParagraph(runsXml: string, pStyleId?: string): string {
  const pPr = pStyleId ? `<w:pPr><w:pStyle w:val="${pStyleId}"/></w:pPr>` : "";
  return `<w:p>${pPr}${runsXml}</w:p>`;
}

// ---------------------------------------------------------------------------
// Inhoud-opbouw (hoofdstukken, checklist, conceptmelding)
// ---------------------------------------------------------------------------

function buildChapterBodyXml(chapter: FillTemplateChapter): string {
  const paras: string[] = [];

  if (chapter.statements.length === 0) {
    paras.push(
      buildParagraph(
        buildRun("Voor dit hoofdstuk is nog geen inhoud vastgelegd.", { italics: true, color: "888888" }),
      ),
    );
  }

  for (const statement of chapter.statements) {
    paras.push(buildParagraph(buildRun(statement.text)));
    const refLabel =
      statement.sourceRefs.length > 0 ? statement.sourceRefs.join(", ") : "geen (handmatig toegevoegd)";
    const metaText = `— ${CATEGORY_LABELS[statement.category]}, bron: ${refLabel}${
      statement.sourceVerified ? "" : " (niet geverifieerd)"
    }`;
    paras.push(
      buildParagraph(
        buildRun(metaText, {
          italics: true,
          sizeHalfPoints: 16,
          color: statement.sourceVerified ? "999999" : "B00020",
        }),
      ),
    );
  }

  if (chapter.missingInfo.length > 0) {
    paras.push(buildParagraph(buildRun("Ontbrekende informatie:", { bold: true })));
    for (const item of chapter.missingInfo) {
      paras.push(buildParagraph(buildRun(`• ${item}`, { color: "B00020" })));
    }
  }

  return paras.join("");
}

function buildChecklistXml(chapters: FillTemplateChapter[], headingStyleId?: string): string {
  const paras: string[] = [
    headingStyleId
      ? buildParagraph(buildRun("Checklist hoofdstukstatus"), headingStyleId)
      : buildParagraph(buildRun("Checklist hoofdstukstatus", { bold: true, sizeHalfPoints: 28 })),
  ];
  for (const chapter of chapters) {
    paras.push(
      buildParagraph(buildRun(`${chapter.title}: `, { bold: true }) + buildRun(STATUS_LABELS[chapter.status])),
    );
    for (const item of chapter.missingInfo) {
      paras.push(buildParagraph(buildRun(`• ${item}`, { color: "B00020" })));
    }
  }
  return paras.join("");
}

function buildConceptNoticeXml(version: number, generatedAt: Date): string {
  const text =
    `CONCEPT — automatisch gegenereerd door V.E.R.A. op ${DATE_FORMATTER.format(generatedAt)}, ` +
    `versie ${version}. Vereist menselijke controle voordat dit verslag wordt ingediend.`;
  return buildParagraph(buildRun(text, { bold: true, color: "B00020" }));
}

// ---------------------------------------------------------------------------
// Hoofdfunctie
// ---------------------------------------------------------------------------

type ParaInfo = {
  start: number;
  end: number;
  text: string;
  styleId: string | null;
  isFullyBold: boolean;
};

/** Is een <w:r>-run vetgedrukt (expliciete <w:b/> zonder w:val="false"/"0")? */
function isRunBold(runXml: string): boolean {
  const rPrMatch = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(runXml);
  if (!rPrMatch) return false;
  const bMatch = /<w:b\b([^/>]*)\/?>/.exec(rPrMatch[1] ?? "");
  if (!bMatch) return false;
  const valMatch = /w:val="([^"]+)"/.exec(bMatch[1] ?? "");
  if (!valMatch?.[1]) return true;
  return !/^(false|0)$/i.test(valMatch[1]);
}

/**
 * Bestaat een paragraaf volledig uit vetgedrukte tekst (alle tekstdragende
 * runs zijn bold)? Gebruikt door de sjabloon-fallback wanneer een template
 * geen echte kopstijlen heeft, maar wel handmatig vetgedrukte "titels".
 */
function paragraphIsFullyBold(raw: string): boolean {
  const runRegex = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
  let match: RegExpExecArray | null;
  let hasText = false;
  while ((match = runRegex.exec(raw)) !== null) {
    const runXml = match[0];
    const text = extractParagraphText(runXml);
    if (text.length === 0) continue;
    hasText = true;
    if (!isRunBold(runXml)) return false;
  }
  return hasText;
}

function parseParagraphs(documentXml: string): ParaInfo[] {
  const paragraphRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g;
  const paras: ParaInfo[] = [];
  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(documentXml)) !== null) {
    const raw = match[0];
    const styleMatch = /<w:pStyle\s+w:val="([^"]+)"/.exec(raw);
    paras.push({
      start: match.index,
      end: match.index + raw.length,
      text: extractParagraphText(raw),
      styleId: styleMatch?.[1] ?? null,
      isFullyBold: paragraphIsFullyBold(raw),
    });
  }
  return paras;
}

/**
 * Matcht elk hoofdstuk op tekst tegen een kandidatenlijst van paragraaf-
 * indexen (kop-paragrafen), op volgorde van hoofdstukken. Elke kandidaat kan
 * maar aan één hoofdstuk worden toegewezen.
 */
function matchChaptersToHeadings(
  paras: ParaInfo[],
  headingParaIndexes: number[],
  chapters: FillTemplateChapter[],
): (number | null)[] {
  const usedParaIndexes = new Set<number>();
  return chapters.map((chapter) => {
    const target = normalizeHeadingText(chapter.title);
    const idx = headingParaIndexes.find(
      (i) => !usedParaIndexes.has(i) && normalizeHeadingText(paras[i]!.text) === target,
    );
    if (idx !== undefined) usedParaIndexes.add(idx);
    return idx ?? null;
  });
}

function findBodyContentEnd(documentXml: string): number {
  const bodyCloseIdx = documentXml.indexOf("</w:body>");
  if (bodyCloseIdx === -1) {
    throw new TemplateFillError("Kon <w:body> niet vinden in het sjabloon.");
  }
  const lastSectPr = documentXml.slice(0, bodyCloseIdx).lastIndexOf("<w:sectPr");
  return lastSectPr !== -1 ? lastSectPr : bodyCloseIdx;
}

/**
 * Vult het originele .docx-sjabloon met de gegenereerde hoofdstukinhoud.
 * Probeert eerst hoofdstuktitels te matchen tegen echte Word-kopstijlen
 * (Kop 1/2/3); heeft het sjabloon die niet (of leverde dat geen enkele match
 * op), dan valt dit terug op paragrafen die volledig vetgedrukt zijn en er
 * qua vorm als een titel uitzien (zie headingHeuristics.ts) — dit is dezelfde
 * heuristiek als bij het aanmaken van het format uit het sjabloon
 * (templateExtraction.ts), zodat een bij upload herkend hoofdstuk hier ook
 * daadwerkelijk teruggevonden wordt. Gooit een TemplateFillError met een
 * begrijpelijke Nederlandse melding als geen van beide strategieën ook maar
 * één hoofdstuktitel kan terugvinden — dit faalt bewust expliciet in plaats
 * van stilzwijgend terug te vallen op een generiek document, zodat nooit
 * onopgemerkt het verkeerde (niet-huisstijl) bestand wordt afgeleverd.
 */
export async function fillDocxTemplate(templateBuffer: Buffer, input: FillTemplateInput): Promise<Buffer> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(templateBuffer);
  } catch {
    throw new TemplateFillError("Het opgeslagen sjabloon is geen geldig .docx-bestand.");
  }

  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new TemplateFillError("Het sjabloon mist word/document.xml en is ongeldig.");
  }
  const documentXml = await documentFile.async("string");

  const stylesFile = zip.file("word/styles.xml");
  const stylesXml = stylesFile ? await stylesFile.async("string") : "";
  const headingStyleIds = findHeadingStyleIds(stylesXml);
  const headingStyleIdSet = new Set(headingStyleIds.values());

  const paras = parseParagraphs(documentXml);

  // Strategie 1: echte Word-kopstijlen (Kop 1/2/3).
  const styleHeadingParaIndexes = paras
    .map((p, i) => (p.styleId && headingStyleIdSet.has(p.styleId) ? i : -1))
    .filter((i) => i >= 0);

  let headingParaIndexes = styleHeadingParaIndexes;
  let matchedParaIndexByChapter =
    styleHeadingParaIndexes.length > 0
      ? matchChaptersToHeadings(paras, styleHeadingParaIndexes, input.chapters)
      : input.chapters.map(() => null);

  // Strategie 2 (fallback): sjablonen zonder echte kopstijlen, maar met
  // handmatig vetgedrukte "titel"-paragrafen. Wordt alleen geprobeerd als
  // strategie 1 geen enkele match opleverde — de twee strategieën worden
  // nooit binnen één vulling gemengd, zodat incidenteel vetgedrukte tekst in
  // een verder goed gestructureerd Kop1-sjabloon niet als extra (onbedoelde)
  // hoofdstukgrens wordt opgevat.
  if (matchedParaIndexByChapter.every((i) => i === null)) {
    const boldHeadingParaIndexes = paras
      .map((p, i) => (p.isFullyBold && looksLikeHeadingText(p.text) ? i : -1))
      .filter((i) => i >= 0);
    const boldMatches = matchChaptersToHeadings(paras, boldHeadingParaIndexes, input.chapters);
    if (boldMatches.some((i) => i !== null)) {
      headingParaIndexes = boldHeadingParaIndexes;
      matchedParaIndexByChapter = boldMatches;
    }
  }

  if (matchedParaIndexByChapter.every((i) => i === null)) {
    throw new TemplateFillError(
      "Geen van de hoofdstuktitels kon worden teruggevonden als kop (of als vetgedrukte titel) in het sjabloon — is het bestand na het aanmaken van dit format gewijzigd?",
    );
  }

  // Vervang, voor elke gematchte kop, alles tot de eerstvolgende kop door de
  // gegenereerde hoofdstukinhoud. In omgekeerde documentvolgorde toepassen
  // zodat eerdere offsets geldig blijven.
  const ranges: { start: number; end: number; xml: string }[] = [];
  matchedParaIndexByChapter.forEach((paraIdx, chapterIdx) => {
    if (paraIdx === null) return;
    const headingPara = paras[paraIdx]!;
    const nextHeadingParaIdx = headingParaIndexes.find((i) => i > paraIdx);
    const sectionEnd =
      nextHeadingParaIdx !== undefined ? paras[nextHeadingParaIdx]!.start : findBodyContentEnd(documentXml);
    ranges.push({
      start: headingPara.end,
      end: sectionEnd,
      xml: buildChapterBodyXml(input.chapters[chapterIdx]!),
    });
  });
  ranges.sort((a, b) => b.start - a.start);

  let result = documentXml;
  for (const range of ranges) {
    result = result.slice(0, range.start) + range.xml + result.slice(range.end);
  }

  // Hoofdstukken die niet als kop teruggevonden zijn: achteraan toevoegen met
  // een gesynthetiseerde kop, zodat geen inhoud stilzwijgend verdwijnt.
  const fallbackHeadingStyleId = headingStyleIds.get(1) ?? headingStyleIds.get(2) ?? headingStyleIds.get(3);
  let appendXml = "";
  input.chapters.forEach((chapter, i) => {
    if (matchedParaIndexByChapter[i] !== null) return;
    appendXml += fallbackHeadingStyleId
      ? buildParagraph(buildRun(chapter.title), fallbackHeadingStyleId)
      : buildParagraph(buildRun(chapter.title, { bold: true, sizeHalfPoints: 28 }));
    appendXml += buildChapterBodyXml(chapter);
  });

  if (input.addChecklist) {
    appendXml += buildChecklistXml(input.chapters, headingStyleIds.get(1));
  }
  if (input.addConceptFootnote) {
    appendXml += buildConceptNoticeXml(input.version, input.generatedAt);
  }

  if (appendXml.length > 0) {
    const insertAt = findBodyContentEnd(result);
    result = result.slice(0, insertAt) + appendXml + result.slice(insertAt);
  }

  zip.file("word/document.xml", result);
  return zip.generateAsync({ type: "nodebuffer" });
}
