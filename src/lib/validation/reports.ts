import { z } from "zod";
import { statementCategorySchema } from "@/lib/ai/schema";

export const createReportSchema = z.object({
  formatTemplateId: z.string().min(1),
  writingStyleKey: z.string().min(1).max(100).nullable().optional(),
  addChecklist: z.boolean().optional(),
  addConceptFootnote: z.boolean().optional(),
});

export const updateReportSettingsSchema = z.object({
  formatTemplateId: z.string().min(1).optional(),
  writingStyleKey: z.string().min(1).max(100).nullable().optional(),
  addChecklist: z.boolean().optional(),
  addConceptFootnote: z.boolean().optional(),
  currentStep: z.number().int().min(1).max(5).optional(),
});

export const pasteSourceSchema = z.object({
  filename: z.string().trim().min(1).max(200).default("Geplakte tekst"),
  text: z.string().min(1),
});

export const updateChapterStatementSchema = z.object({
  id: z.string().min(1).optional(),
  text: z.string().trim().min(1).max(4000),
  category: statementCategorySchema,
  sourceRefs: z.array(z.string().min(1).max(32)).max(20).default([]),
  origin: z.enum(["AI", "USER"]).default("USER"),
});

export const updateChapterSchema = z.object({
  statements: z.array(updateChapterStatementSchema).max(300),
  missingInfo: z.array(z.string().trim().min(1).max(500)).max(50),
  markReviewed: z.boolean().optional(),
});
