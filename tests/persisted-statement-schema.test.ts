import { describe, it, expect } from "vitest";
import { persistedStatementsArraySchema } from "@/lib/reports/types";

// `original` (voor "terug naar AI-versie") is toegevoegd ná de eerste versie
// van dit schema. Deze test bewaakt twee dingen tegelijk: (1) bestaande,
// vóór deze wijziging opgeslagen hoofdstukken (zonder `original`-veld in de
// JSON) blijven gewoon inleesbaar, en (2) nieuwe statements ronden `original`
// correct door de parse heen.

describe("persistedStatementsArraySchema", () => {
  it("leest oudere, opgeslagen statements zonder `original`-veld probleemloos in (backward compatible)", () => {
    const legacy = [
      {
        id: "s1",
        text: "Een bewering zonder original-veld.",
        category: "FEIT",
        sourceRefs: ["B1-1"],
        origin: "AI",
        sourceVerified: true,
      },
    ];
    const parsed = persistedStatementsArraySchema.parse(legacy);
    expect(parsed[0]?.original).toBeUndefined();
  });

  it("rondt een aanwezig `original`-veld correct door de parse heen", () => {
    const withOriginal = [
      {
        id: "s1",
        text: "Bewerkte tekst.",
        category: "VERKLARING",
        sourceRefs: ["B1-2"],
        origin: "AI",
        sourceVerified: true,
        original: { text: "Oorspronkelijke AI-tekst.", category: "FEIT", sourceRefs: ["B1-1"] },
      },
    ];
    const parsed = persistedStatementsArraySchema.parse(withOriginal);
    expect(parsed[0]?.original).toEqual({
      text: "Oorspronkelijke AI-tekst.",
      category: "FEIT",
      sourceRefs: ["B1-1"],
    });
  });

  it("accepteert expliciet `original: null` (handmatig toegevoegde statements)", () => {
    const manual = [
      {
        id: "s2",
        text: "Handmatig toegevoegd.",
        category: "FEIT",
        sourceRefs: [],
        origin: "USER",
        sourceVerified: true,
        original: null,
      },
    ];
    const parsed = persistedStatementsArraySchema.parse(manual);
    expect(parsed[0]?.original).toBeNull();
  });
});
