import { env } from "@/lib/env";
import { validateChapter, type ValidatableStatement, type ChapterStatusValue } from "@/lib/validators";
import type { ValidatorRuleSet, FormatValidatorRules } from "@/lib/formats/types";

const REPORT_TITLE_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * Genereert een niet-herleidbare titel (documenttype + datum). Bewust NOOIT
 * gebaseerd op door de gebruiker getypte cliëntnamen, zodat rapport-metadata
 * (die permanent bewaard blijft, zie privacyhoofdstuk) nooit herleidbare
 * persoonsgegevens bevat.
 */
export function generateReportTitle(documentTypeName: string, now: Date = new Date()): string {
  return `${documentTypeName} — ${REPORT_TITLE_FORMATTER.format(now)}`;
}

export function computeExpiresAt(now: Date = new Date()): Date {
  const expires = new Date(now);
  expires.setDate(expires.getDate() + env.reportRetentionDays);
  return expires;
}

/**
 * Berekent live (niet-persistent) validatie-issues voor een hoofdstuk, op
 * basis van de huidige inhoud. Dit is puur informatief voor de gebruiker —
 * de daadwerkelijke `status` in de database verandert alleen wanneer de
 * gebruiker het hoofdstuk expliciet (opnieuw) als gecontroleerd markeert.
 */
export function computeChapterIssues(
  statements: ValidatableStatement[],
  missingInfo: string[],
  rules: FormatValidatorRules,
  chapterKey: string,
): { computedStatus: ChapterStatusValue; issues: string[] } {
  const ruleSet: ValidatorRuleSet | undefined = rules[chapterKey];
  const result = validateChapter({ statements, missingInfo }, ruleSet);
  return { computedStatus: result.status, issues: result.issues };
}
