import type { AIProvider } from "@/lib/ai/provider";
import { OpenAIProvider } from "@/lib/ai/openaiProvider";

let providerInstance: AIProvider | null = null;

/**
 * Fabrieksfunctie voor de geconfigureerde AIProvider. Op dit moment is er
 * alleen een OpenAI-implementatie; een andere provider toevoegen betekent
 * hier een tak toevoegen (bv. op basis van een AI_PROVIDER env var) zonder
 * dat callers ergens anders in de app hoeven te wijzigen.
 */
export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = new OpenAIProvider();
  }
  return providerInstance;
}

export type { AIProvider, AnalyzeReportInput } from "@/lib/ai/provider";
