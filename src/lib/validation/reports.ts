import { z } from "zod";
import { statementCategorySchema } from "@/lib/ai/schema";

export const createReportSchema = z.object({
  formatTemplateId: z.string().min(1),
  writingStyleKey: z.string().min(1).max(100).nullable().optional(),
  addChecklist: z.boolean().optional(),
  addConceptFootnote: z.boolean().optional(),
  reference: z.string().trim().max(200).nullable().optional(),
});

export const updateReportSettingsSchema = z.object({
  formatTemplateId: z.string().min(1).optional(),
  writingStyleKey: z.string().min(1).max(100).nullable().optional(),
  addChecklist: z.boolean().optional(),
  addConceptFootnote: z.boolean().optional(),
  currentStep: z.number().int().min(1).max(5).optional(),
  reference: z.string().trim().max(200).nullable().optional(),
});

export const pasteSourceSchema = z.object({
  filename: z.string().trim().min(1).max(200).default("Geplakte tekst"),
  text: z.string().min(1),
});

const originalStatementSchema = z.object({
  text: z.string().min(1).max(4000),
  category: statementCategorySchema,
  sourceRefs: z.array(z.string().min(1).max(32)).max(20),
});

export const updateChapterStatementSchema = z.object({
  id: z.string().min(1).optional(),
  text: z.string().trim().min(1).max(4000),
  category: statementCategorySchema,
  sourceRefs: z.array(z.string().min(1).max(32)).max(20).default([]),
  origin: z.enum(["AI", "USER"]).default("USER"),
  // Onveranderlijke momentopname van de oorspronkelijke AI-output van deze
  // bewering (gezet bij analyze, nooit door de server herschreven) — stelt
  // de gebruiker in staat een bewerkte AI-bewering terug te zetten. De
  // client stuurt dit veld gewoon ongewijzigd terug bij elke opslag.
  original: originalStatementSchema.nullable().optional(),
});

export const updateChapterSchema = z.object({
  statements: z.array(updateChapterStatementSchema).max(300),
  missingInfo: z.array(z.string().trim().min(1).max(500)).max(50),
  markReviewed: z.boolean().optional(),
});
