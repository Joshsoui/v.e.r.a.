import { describe, it, expect } from "vitest";
import {
  validateChapter,
  findUnverifiedSourceRefs,
  findMisusedRegulationRefs,
  validateChapterKeyCompleteness,
} from "@/lib/validators";
import type { SourceSegment } from "@/lib/ai/sourceSegments";

describe("validateChapter", () => {
  it("markeert een hoofdstuk als compleet als aan alle regels voldaan is", () => {
    const result = validateChapter(
      {
        statements: [
          { text: "Feit A.", category: "FEIT", sourceRefs: ["B1-1"] },
          { text: "Duiding.", category: "PROFESSIONELE_DUIDING", sourceRefs: ["B1-2"] },
        ],
        missingInfo: [],
      },
      { minStatements: 1, requiredCategories: ["FEIT"], requiredKeywords: [], forbidMissingInfo: true },
    );
    expect(result.status).toBe("COMPLEET");
    expect(result.issues).toHaveLength(0);
  });

  it("markeert onvolledig bij te weinig statements", () => {
    const result = validateChapter(
      { statements: [], missingInfo: [] },
      { minStatements: 2, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: true },
    );
    expect(result.status).toBe("ONVOLLEDIG");
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("markeert onvolledig bij ontbrekende verplichte categorie", () => {
    const result = validateChapter(
      { statements: [{ text: "Feit.", category: "FEIT", sourceRefs: ["B1-1"] }], missingInfo: [] },
      {
        minStatements: 1,
        requiredCategories: ["VERKLARING"],
        requiredKeywords: [],
        forbidMissingInfo: true,
      },
    );
    expect(result.status).toBe("ONVOLLEDIG");
    expect(result.issues.some((i) => i.includes("verklaring"))).toBe(true);
  });

  it("markeert onvolledig als missingInfo niet leeg is en forbidMissingInfo true is", () => {
    const result = validateChapter(
      {
        statements: [{ text: "Feit.", category: "FEIT", sourceRefs: ["B1-1"] }],
        missingInfo: ["Schoolgegevens ontbreken."],
      },
      { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: true },
    );
    expect(result.status).toBe("ONVOLLEDIG");
  });

  it("staat missingInfo toe zonder status te verlagen als forbidMissingInfo false is", () => {
    const result = validateChapter(
      {
        statements: [{ text: "Feit.", category: "FEIT", sourceRefs: ["B1-1"] }],
        missingInfo: ["Nog te bevestigen."],
      },
      { minStatements: 1, requiredCategories: [], requiredKeywords: [], forbidMissingInfo: false },
    );
    expect(result.status).toBe("COMPLEET");
  });

  it("gebruikt default-regels als er geen ruleset is (minStatements 1)", () => {
    const result = validateChapter({ statements: [], missingInfo: [] }, undefined);
    expect(result.status).toBe("ONVOLLEDIG");
  });
});

describe("findUnverifiedSourceRefs (zero-fabrication-bewaking)", () => {
  const segments: SourceSegment[] = [
    { id: "B1-1", sourceDocumentId: "s1", sourceLabel: "Bron 1", index: 1, text: "..." },
    { id: "B1-2", sourceDocumentId: "s1", sourceLabel: "Bron 1", index: 2, text: "..." },
  ];

  it("vindt geen problemen als alle refs bestaan", () => {
    const result = findUnverifiedSourceRefs(
      [{ text: "x", category: "FEIT", sourceRefs: ["B1-1", "B1-2"] }],
      segments,
    );
    expect(result).toHaveLength(0);
  });

  it("detecteert een verzonnen (niet-bestaand) segment-id", () => {
    const result = findUnverifiedSourceRefs(
      [{ text: "x", category: "FEIT", sourceRefs: ["B1-1", "B9-9"] }],
      segments,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.invalidRefs).toEqual(["B9-9"]);
  });
});

describe("findMisusedRegulationRefs", () => {
  const regulationIds = new Set(["V1-1", "V1-2"]);

  it("geeft geen misbruik terug als er geen verordening-ids zijn opgegeven", () => {
    const result = findMisusedRegulationRefs(
      [{ text: "x", category: "PROFESSIONELE_DUIDING", sourceRefs: ["V1-1"] }],
      new Set(),
    );
    expect(result).toEqual([]);
  });

  it("staat een PROFESSIONELE_DUIDING toe die zowel een B-id als een V-id citeert", () => {
    const result = findMisusedRegulationRefs(
      [{ text: "x", category: "PROFESSIONELE_DUIDING", sourceRefs: ["B1-1", "V1-1"] }],
      regulationIds,
    );
    expect(result).toEqual([]);
  });

  it("markeert een PROFESSIONELE_DUIDING die UITSLUITEND een V-id citeert", () => {
    const result = findMisusedRegulationRefs(
      [{ text: "x", category: "PROFESSIONELE_DUIDING", sourceRefs: ["V1-1"] }],
      regulationIds,
    );
    expect(result).toEqual([0]);
  });

  it("markeert een FEIT dat een V-id citeert, ook naast een B-id", () => {
    const result = findMisusedRegulationRefs(
      [{ text: "x", category: "FEIT", sourceRefs: ["B1-1", "V1-1"] }],
      regulationIds,
    );
    expect(result).toEqual([0]);
  });

  it("markeert een VERKLARING die een V-id citeert", () => {
    const result = findMisusedRegulationRefs(
      [{ text: "x", category: "VERKLARING", sourceRefs: ["B1-1", "V1-2"] }],
      regulationIds,
    );
    expect(result).toEqual([0]);
  });

  it("raakt statements zonder enige V-id niet aan", () => {
    const result = findMisusedRegulationRefs(
      [
        { text: "a", category: "FEIT", sourceRefs: ["B1-1"] },
        { text: "b", category: "PROFESSIONELE_DUIDING", sourceRefs: ["B1-1", "V1-1"] },
      ],
      regulationIds,
    );
    expect(result).toEqual([]);
  });
});

describe("validateChapterKeyCompleteness", () => {
  it("geeft geen afwijkingen bij een exacte match", () => {
    const result = validateChapterKeyCompleteness(["a", "b"], ["a", "b"]);
    expect(result.missing).toHaveLength(0);
    expect(result.unexpected).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
  });

  it("detecteert ontbrekende hoofdstukken", () => {
    const result = validateChapterKeyCompleteness(["a"], ["a", "b"]);
    expect(result.missing).toEqual(["b"]);
  });

  it("detecteert onverwachte (verzonnen) hoofdstukken", () => {
    const result = validateChapterKeyCompleteness(["a", "verzonnen"], ["a"]);
    expect(result.unexpected).toEqual(["verzonnen"]);
  });

  it("detecteert duplicaten", () => {
    const result = validateChapterKeyCompleteness(["a", "a"], ["a"]);
    expect(result.duplicates).toEqual(["a"]);
  });
});
