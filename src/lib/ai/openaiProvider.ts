import OpenAI from "openai";
import { env } from "@/lib/env";
import type { AIProvider, AnalyzeReportInput } from "@/lib/ai/provider";
import {
  buildReportAnalysisSchemaForChapters,
  toStrictJsonSchema,
  type ReportAnalysis,
} from "@/lib/ai/schema";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import { ApiError } from "@/lib/utils/errors";

export class OpenAIProvider implements AIProvider {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.openaiApiKey,
      timeout: env.openaiTimeoutMs,
      maxRetries: 1,
    });
  }

  async analyzeReport(input: AnalyzeReportInput): Promise<ReportAnalysis> {
    const chapterKeys = input.chapters.map((c) => c.key);
    const segmentIds = input.segments.map((s) => s.id);
    const schema = buildReportAnalysisSchemaForChapters(chapterKeys, segmentIds);
    const jsonSchema = toStrictJsonSchema(schema);

    const instructions = buildSystemPrompt(input.disciplineName, input.documentTypeName);
    const userInput = buildUserPrompt(input.chapters, input.writingStyle, input.segments);

    let response;
    try {
      response = await this.client.responses.create(
        {
          model: env.openaiModel,
          instructions,
          input: userInput,
          text: {
            format: {
              type: "json_schema",
              name: "vera_report_analysis",
              schema: jsonSchema,
              strict: true,
            },
          },
          store: false,
          tools: [],
        },
        { timeout: env.openaiTimeoutMs },
      );
    } catch (err) {
      console.error("OpenAI Responses API-aanroep mislukt:", err);
      throw new ApiError(
        502,
        "De VERA-analyse is mislukt. Probeer het later opnieuw.",
        { cause: err },
      );
    }

    if (response.status === "incomplete") {
      throw new ApiError(
        502,
        "De VERA-analyse kon niet volledig afgerond worden. Probeer het opnieuw, eventueel met minder brontekst.",
      );
    }

    const outputText = response.output_text;
    if (!outputText) {
      throw new ApiError(502, "De AI gaf geen bruikbare output terug.");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(outputText);
    } catch (err) {
      console.error("Kon AI-output niet als JSON parsen:", err);
      throw new ApiError(502, "De AI-output was niet geldig gestructureerd.");
    }

    const result = schema.safeParse(parsedJson);
    if (!result.success) {
      console.error("AI-output voldeed niet aan het schema:", result.error.issues);
      throw new ApiError(502, "De AI-output voldeed niet aan het verwachte format.");
    }

    return result.data;
  }
}
