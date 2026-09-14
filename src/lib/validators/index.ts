// Deterministische (niet-AI) validators. Deze bepalen de hoofdstukstatus en
// signaleren ontbrekende informatie puur op basis van regels — geen LLM-call,
// dus voorspelbaar, snel en niet aan modelgedrag onderhevig.

import type { ValidatorRuleSet } from "@/lib/formats/types";
import type { StatementCategory } from "@/lib/ai/schema";
import type { SourceSegment } from "@/lib/ai/sourceSegments";

export type ChapterStatusValue = "COMPLEET" | "ONVOLLEDIG" | "NIET_GECONTROLEERD";

export type ValidatableStatement = {
  text: string;
  category: StatementCategory;
  sourceRefs: string[];
};

export type ValidatableChapter = {
  statements: ValidatableStatement[];
  missingInfo: string[];
};

export type ChapterValidationResult = {
  status: ChapterStatusValue;
  issues: string[];
};

const CATEGORY_LABELS: Record<StatementCategory, string> = {
  FEIT: "feit",
  VERKLARING: "verklaring van betrokkene",
  PROFESSIONELE_DUIDING: "professionele duiding",
};

const DEFAULT_RULES: ValidatorRuleSet = {
  minStatements: 1,
  requiredCategories: [],
  requiredKeywords: [],
  forbidMissingInfo: true,
};

/**
 * Bepaalt of een hoofdstuk compleet is. Wordt aangeroepen nadat een
 * hoofdstuk voor het eerst door de AI is ingevuld, en telkens opnieuw na
 * bewerking door de gebruiker.
 */
export function validateChapter(
  chapter: ValidatableChapter,
  rules: ValidatorRuleSet | undefined,
): ChapterValidationResult {
  const effectiveRules = rules ?? DEFAULT_RULES;
  const issues: string[] = [];

  if (chapter.statements.length < effectiveRules.minStatements) {
    const expectedNoun = effectiveRules.minStatements === 1 ? "onderdeel" : "onderdelen";
    const foundNoun = chapter.statements.length === 1 ? "onderdeel" : "onderdelen";
    issues.push(
      `Minimaal ${effectiveRules.minStatements} ${expectedNoun} verwacht in dit hoofdstuk, ${chapter.statements.length} ${foundNoun} gevonden.`,
    );
  }

  for (const category of effectiveRules.requiredCategories) {
    const hasCategory = chapter.statements.some((s) => s.category === category);
    if (!hasCategory) {
      issues.push(`Verwacht minstens één ${CATEGORY_LABELS[category]} in dit hoofdstuk.`);
    }
  }

  if (effectiveRules.requiredKeywords.length > 0) {
    const haystack = chapter.statements.map((s) => s.text.toLowerCase()).join(" \n ");
    for (const keyword of effectiveRules.requiredKeywords) {
      if (!haystack.includes(keyword.toLowerCase())) {
        issues.push(`Er is geen informatie gevonden over "${keyword}".`);
      }
    }
  }

  if (effectiveRules.forbidMissingInfo && chapter.missingInfo.length > 0) {
    const clause =
      chapter.missingInfo.length === 1
        ? "1 ontbrekend punt gesignaleerd dat nog aangevuld moet worden."
        : `${chapter.missingInfo.length} ontbrekende punten gesignaleerd die nog aangevuld moeten worden.`;
    issues.push(clause);
  }

  return {
    status: issues.length > 0 ? "ONVOLLEDIG" : "COMPLEET",
    issues,
  };
}

/**
 * Zero-fabrication-bewaking: controleert dat elke bronverwijzing van elke
 * bewering daadwerkelijk bestaat als brontekst-segment. Dit vangt eventuele
 * hallucinaties van het model op — als het model een niet-bestaand segment
 * citeert, wordt dat hier gedetecteerd zodat de bewering als "niet
 * geverifieerd" gemarkeerd kan worden in plaats van stilzwijgend vertrouwd.
 */
export function findUnverifiedSourceRefs(
  statements: ValidatableStatement[],
  segments: SourceSegment[],
): { statementIndex: number; invalidRefs: string[] }[] {
  const validIds = new Set(segments.map((s) => s.id));
  const result: { statementIndex: number; invalidRefs: string[] }[] = [];

  statements.forEach((statement, index) => {
    const invalidRefs = statement.sourceRefs.filter((ref) => !validIds.has(ref));
    if (invalidRefs.length > 0) {
      result.push({ statementIndex: index, invalidRefs });
    }
  });

  return result;
}

/**
 * Controleert dat de AI-output exact de verwachte hoofdstukken bevat (geen
 * extra, geen ontbrekende, geen duplicaten) — beschermt tegen het "verzinnen"
 * van hoofdstukken buiten het gekozen format.
 */
export function validateChapterKeyCompleteness(
  returnedKeys: string[],
  expectedKeys: string[],
): { missing: string[]; unexpected: string[]; duplicates: string[] } {
  const expectedSet = new Set(expectedKeys);
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const unexpected: string[] = [];

  for (const key of returnedKeys) {
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
    if (!expectedSet.has(key)) unexpected.push(key);
  }

  const missing = expectedKeys.filter((key) => !seen.has(key));

  return { missing, unexpected, duplicates };
}
