import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  reportAnalysisSchema,
  buildReportAnalysisSchemaForChapters,
  toStrictJsonSchema,
  assertStrictJsonSchema,
} from "@/lib/ai/schema";

// Deze test bewaakt expliciet dat het zod-schema (gebruikt om AI-antwoorden
// te valideren) en het JSON-schema dat we aan OpenAI Structured Outputs geven
// nooit uit elkaar kunnen lopen: toStrictJsonSchema() genereert het
// JSON-schema RECHTSTREEKS uit hetzelfde zod-schema, dus er is maar één bron
// van waarheid. Deze test bevestigt dat die generatie voldoet aan OpenAI's
// strict-mode eisen (additionalProperties:false + alle properties required,
// recursief) — en dat een schema dat dat NIET doet (bv. met .optional())
// terecht wordt afgewezen.

describe("schema-sync: zod <-> OpenAI structured-output JSON-schema", () => {
  it("genereert een strikt JSON-schema uit het algemene reportAnalysisSchema", () => {
    const jsonSchema = toStrictJsonSchema(reportAnalysisSchema);
    expect(jsonSchema.$schema).toBeUndefined();
    expect(() => assertStrictJsonSchema(jsonSchema)).not.toThrow();
  });

  it("genereert een strikt JSON-schema per format met beperkte hoofdstuk-keys", () => {
    const chapterKeys = ["aanleiding", "onderzoek", "conclusie"];
    const schema = buildReportAnalysisSchemaForChapters(chapterKeys);
    const jsonSchema = toStrictJsonSchema(schema);

    assertStrictJsonSchema(jsonSchema);

    const properties = jsonSchema.properties as Record<string, unknown>;
    const chaptersSchema = properties.chapters as Record<string, unknown>;
    const items = chaptersSchema.items as Record<string, unknown>;
    const chapterProps = items.properties as Record<string, unknown>;
    const keySchema = chapterProps.key as Record<string, unknown>;

    expect(keySchema.enum).toEqual(chapterKeys);
    expect(chaptersSchema.minItems).toBe(chapterKeys.length);
    expect(chaptersSchema.maxItems).toBe(chapterKeys.length);
  });

  it("beperkt sourceRefs tot de opgegeven segment-id's (structurele zero-fabrication)", () => {
    const chapterKeys = ["aanleiding"];
    const segmentIds = ["B1-1", "B1-2", "B2-1"];
    const schema = buildReportAnalysisSchemaForChapters(chapterKeys, segmentIds);
    const jsonSchema = toStrictJsonSchema(schema);

    assertStrictJsonSchema(jsonSchema);

    const properties = jsonSchema.properties as Record<string, unknown>;
    const chaptersSchema = properties.chapters as Record<string, unknown>;
    const items = chaptersSchema.items as Record<string, unknown>;
    const chapterProps = items.properties as Record<string, unknown>;
    const statementsSchema = chapterProps.statements as Record<string, unknown>;
    const statementItems = statementsSchema.items as Record<string, unknown>;
    const statementProps = statementItems.properties as Record<string, unknown>;
    const sourceRefsSchema = statementProps.sourceRefs as Record<string, unknown>;
    const sourceRefItems = sourceRefsSchema.items as Record<string, unknown>;

    expect(sourceRefItems.enum).toEqual(segmentIds);

    // Een schema safeParse van een verzonnen segment-id moet nu al op
    // zod-niveau falen (vóórdat het OpenAI-schema er al helemaal niet mee
    // zou instemmen).
    const result = schema.safeParse({
      chapters: [
        {
          key: "aanleiding",
          statements: [{ text: "x", category: "FEIT", sourceRefs: ["VERZONNEN-ID"] }],
          missingInfo: [],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("wijst een schema met .optional() af (zou strict-mode breken)", () => {
    const badSchema = z.object({
      chapters: z.array(
        z.object({
          key: z.string(),
          // .optional() i.p.v. .nullable() — dit MAG niet door de sync-guard heen.
          note: z.string().optional(),
        }),
      ),
    });

    expect(() => toStrictJsonSchema(badSchema)).toThrow(/required/i);
  });

  it("valideert een geldig AI-antwoord tegen het schema", () => {
    const chapterKeys = ["aanleiding"];
    const schema = buildReportAnalysisSchemaForChapters(chapterKeys);
    const result = schema.safeParse({
      chapters: [
        {
          key: "aanleiding",
          statements: [
            { text: "Voorbeeldbewering.", category: "FEIT", sourceRefs: ["B1-1"] },
          ],
          missingInfo: [],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("wijst een AI-antwoord met een onbekende hoofdstuk-key af", () => {
    const schema = buildReportAnalysisSchemaForChapters(["aanleiding"]);
    const result = schema.safeParse({
      chapters: [{ key: "verzonnen-hoofdstuk", statements: [], missingInfo: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("wijst een statement zonder bronverwijzing af (zero-fabrication)", () => {
    const schema = buildReportAnalysisSchemaForChapters(["aanleiding"]);
    const result = schema.safeParse({
      chapters: [
        {
          key: "aanleiding",
          statements: [{ text: "Bewering zonder bron.", category: "FEIT", sourceRefs: [] }],
          missingInfo: [],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
