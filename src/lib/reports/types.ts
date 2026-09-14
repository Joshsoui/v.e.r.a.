import { z } from "zod";
import { statementCategorySchema } from "@/lib/ai/schema";

// Persisted-statement-vorm: een superset van wat de AI teruggeeft. `origin`
// en `sourceVerified` zijn puur applicatie-metadata (nooit onderdeel van het
// AI-structured-output-schema) om AI-afkomstige van door de gebruiker
// toegevoegde/bewerkte inhoud te onderscheiden en om te laten zien of een
// bronverwijzing daadwerkelijk bestaat.
export const persistedStatementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(4000),
  category: statementCategorySchema,
  sourceRefs: z.array(z.string()).default([]),
  origin: z.enum(["AI", "USER"]),
  sourceVerified: z.boolean(),
});
export type PersistedStatement = z.infer<typeof persistedStatementSchema>;

export const persistedStatementsArraySchema = z.array(persistedStatementSchema);
export const missingInfoArraySchema = z.array(z.string());
