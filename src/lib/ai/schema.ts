import { z } from "zod";

// ============================================================================
// Zero-fabrication schema — de EENIGE bron van waarheid voor de structuur die
// de AI mag teruggeven. Dit zod-schema wordt direct omgezet naar het strikte
// JSON-schema dat we aan de OpenAI Responses API geven (zie toStrictJsonSchema
// hieronder en openaiProvider.ts). Zo kunnen het zod-schema (voor validatie in
// de app) en het OpenAI-schema (voor structured outputs) nooit uit elkaar
// lopen — test/schema-sync.test.ts controleert dit expliciet.
//
// Belangrijk voor OpenAI Structured Outputs "strict" mode:
// - GEEN z.optional() gebruiken — elk veld moet in "required" staan.
//   Een veld dat er niet altijd hoeft te zijn, modelleren we als nullable.
// - additionalProperties:false wordt door zod's toJSONSchema() automatisch op
//   elk objectniveau gezet.
// ============================================================================

export const statementCategorySchema = z.enum([
  "FEIT",
  "VERKLARING",
  "PROFESSIONELE_DUIDING",
]);
export type StatementCategory = z.infer<typeof statementCategorySchema>;

export const statementSchema = z.object({
  text: z.string().min(1).max(2000),
  category: statementCategorySchema,
  // Verplichte bronverwijzing(en) naar brontekst-segmenten, bv. ["B1-3"].
  // Nooit leeg: elke bewering moet herleidbaar zijn tot de bron.
  sourceRefs: z.array(z.string().min(1).max(32)).min(1).max(20),
});
export type Statement = z.infer<typeof statementSchema>;

export const chapterResultSchema = z.object({
  key: z.string().min(1).max(100),
  statements: z.array(statementSchema).max(200),
  // Signalen van ontbrekende, voor dit hoofdstuk relevante informatie. Nooit
  // aangevuld met aannames — puur "dit mist er nog".
  missingInfo: z.array(z.string().min(1).max(500)).max(50),
});
export type ChapterResult = z.infer<typeof chapterResultSchema>;

export const reportAnalysisSchema = z.object({
  chapters: z.array(chapterResultSchema).min(1).max(50),
});
export type ReportAnalysis = z.infer<typeof reportAnalysisSchema>;

/**
 * Bouwt per aanroep een schema waarin `key` beperkt is tot exact de
 * hoofdstukken van het gekozen format, én — indien segmentIds is opgegeven —
 * waarin elke bronverwijzing (sourceRefs) beperkt is tot de daadwerkelijk
 * bestaande brontekst-segment-id's van deze aanroep. Dat laatste maakt het
 * voor het model STRUCTUREEL onmogelijk om een verzonnen bron-id te citeren:
 * OpenAI's strict Structured Outputs wijst elke waarde buiten de opgegeven
 * enum af. findUnverifiedSourceRefs() in lib/validators blijft daarnaast
 * bestaan als defense-in-depth (bv. voor een toekomstige provider die enums
 * met heel veel waarden niet even strikt afdwingt).
 */
export function buildReportAnalysisSchemaForChapters(
  chapterKeys: string[],
  segmentIds?: string[],
) {
  if (chapterKeys.length === 0) {
    throw new Error("chapterKeys mag niet leeg zijn.");
  }
  const keyEnum = z.enum(chapterKeys as [string, ...string[]]);
  const sourceRefSchema =
    segmentIds && segmentIds.length > 0
      ? z.enum(segmentIds as [string, ...string[]])
      : z.string().min(1).max(32);

  return z.object({
    chapters: z
      .array(
        z.object({
          key: keyEnum,
          statements: z
            .array(
              z.object({
                text: z.string().min(1).max(2000),
                category: statementCategorySchema,
                sourceRefs: z.array(sourceRefSchema).min(1).max(20),
              }),
            )
            .max(200),
          missingInfo: z.array(z.string().min(1).max(500)).max(50),
        }),
      )
      .min(chapterKeys.length)
      .max(chapterKeys.length),
  });
}

/**
 * Zet een zod-schema om naar een JSON-schema dat voldoet aan de eisen van
 * OpenAI's Structured Outputs "strict" modus: geen `$schema`-sleutel, en
 * recursief additionalProperties:false + alle properties verplicht (zod
 * regelt dat laatste vanzelf zolang er geen .optional() gebruikt wordt, zie
 * assertStrictJsonSchema hieronder die dat expliciet controleert).
 */
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<
    string,
    unknown
  >;
  delete jsonSchema.$schema;
  assertStrictJsonSchema(jsonSchema);
  return jsonSchema;
}

/**
 * Controleert recursief dat elk object-niveau additionalProperties:false
 * heeft en dat "required" exact overeenkomt met alle keys in "properties".
 * Gooit een fout als dat niet zo is — dit is de check die schema-drift
 * tussen zod en het OpenAI-schema onmogelijk maakt (zie
 * tests/schema-sync.test.ts).
 */
export function assertStrictJsonSchema(node: unknown, path = "$"): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => assertStrictJsonSchema(item, `${path}[${i}]`));
    return;
  }
  if (node === null || typeof node !== "object") return;

  const obj = node as Record<string, unknown>;

  if (obj.type === "object" || obj.properties) {
    if (obj.additionalProperties !== false) {
      throw new Error(
        `Schema op ${path} heeft geen additionalProperties:false (strict outputs vereisen dit).`,
      );
    }
    const properties = (obj.properties ?? {}) as Record<string, unknown>;
    const propertyKeys = Object.keys(properties).sort();
    const required = (Array.isArray(obj.required) ? obj.required : []).slice().sort();
    if (
      propertyKeys.length !== required.length ||
      propertyKeys.some((k, i) => k !== required[i])
    ) {
      throw new Error(
        `Schema op ${path} heeft properties die niet allemaal 'required' zijn: ` +
          `properties=[${propertyKeys.join(", ")}] required=[${required.join(", ")}]. ` +
          `Gebruik .nullable() in plaats van .optional() in het zod-schema.`,
      );
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    assertStrictJsonSchema(value, `${path}.${key}`);
  }
}
