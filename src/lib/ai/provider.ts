import type { ChapterDefinition, WritingStyleOption } from "@/lib/formats/types";
import type { SourceSegment } from "@/lib/ai/sourceSegments";
import type { ReportAnalysis } from "@/lib/ai/schema";

export type AnalyzeReportInput = {
  disciplineName: string;
  documentTypeName: string;
  chapters: ChapterDefinition[];
  writingStyle: WritingStyleOption | null;
  segments: SourceSegment[];
  /** Verordening-segmenten (V-ID's) — zie prompt.ts regel 9 voor het gebruik. */
  regulationSegments?: SourceSegment[];
};

export type TranscribeAudioInput = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
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
  /**
   * Zet een gespreksopname om in platte tekst. De aanroeper geeft alleen de
   * ruwe bytes door (in-memory, nooit weggeschreven) en krijgt uitsluitend
   * het transcript terug — de audio zelf wordt door deze laag niet bewaard.
   */
  transcribeAudio(input: TranscribeAudioInput): Promise<string>;
}
