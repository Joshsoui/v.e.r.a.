import { z } from "zod";
import { statementCategorySchema } from "@/lib/ai/schema";

// ============================================================================
// Configuratie-types voor FormatTemplate.chapters / .writingStyles /
// .validatorRules (JSON-kolommen). Dit is de modulaire kern van V.E.R.A.:
// een nieuw vakgebied, documenttype of gemeentevariant toevoegen = een nieuwe
// FormatTemplate-rij invullen, geen code wijzigen.
// ============================================================================

export const chapterDefinitionSchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  order: z.number().int().min(0),
  /** Instructie voor de AI: waar moet dit hoofdstuk over gaan. */
  instructions: z.string().min(1).max(4000),
  /** Mensleesbare lijst van verplichte onderdelen — gebruikt in AI-instructies én als fallback-checklist door de validators. */
  requiredElements: z.array(z.string().min(1).max(300)).default([]),
});
export type ChapterDefinition = z.infer<typeof chapterDefinitionSchema>;

export const writingStyleOptionSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
});
export type WritingStyleOption = z.infer<typeof writingStyleOptionSchema>;

export const validatorRuleSetSchema = z.object({
  minStatements: z.number().int().min(0).default(1),
  requiredCategories: z.array(statementCategorySchema).default([]),
  requiredKeywords: z.array(z.string().min(1).max(200)).default([]),
  forbidMissingInfo: z.boolean().default(true),
});
export type ValidatorRuleSet = z.infer<typeof validatorRuleSetSchema>;

export const formatChaptersSchema = z.array(chapterDefinitionSchema).min(1);
export const formatWritingStylesSchema = z.array(writingStyleOptionSchema);
export const formatValidatorRulesSchema = z.record(z.string(), validatorRuleSetSchema);

export type FormatValidatorRules = z.infer<typeof formatValidatorRulesSchema>;

export function parseChapters(json: unknown): ChapterDefinition[] {
  return formatChaptersSchema.parse(json);
}

export function parseWritingStyles(json: unknown): WritingStyleOption[] {
  return formatWritingStylesSchema.parse(json);
}

export function parseValidatorRules(json: unknown): FormatValidatorRules {
  return formatValidatorRulesSchema.parse(json);
}
