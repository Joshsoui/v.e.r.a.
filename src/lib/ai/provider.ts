import type { ChapterDefinition, WritingStyleOption } from "@/lib/formats/types";
import type { SourceSegment } from "@/lib/ai/sourceSegments";
import type { ReportAnalysis } from "@/lib/ai/schema";

export type AnalyzeReportInput = {
  disciplineName: string;
  documentTypeName: string;
  chapters: ChapterDefinition[];
  writingStyle: WritingStyleOption | null;
  segments: SourceSegment[];
};

/**
 * Abstractielaag voor LLM-aanbieders. Alles in de rest van de applicatie
 * praat tegen deze interface — nooit rechtstreeks tegen een specifieke
 * provider-SDK. Een nieuwe provider toevoegen (bv. Azure OpenAI, Anthropic)
 * betekent: een nieuwe implementatie van AIProvider, geen wijzigingen
 * elders.
 */
export interface AIProvider {
  analyzeReport(input: AnalyzeReportInput): Promise<ReportAnalysis>;
}
