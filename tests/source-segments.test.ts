import { describe, it, expect } from "vitest";
import { segmentRegulations } from "@/lib/ai/sourceSegments";

describe("segmentRegulations", () => {
  it("segmenteert verordeningen met een V-prefix, gescheiden per alinea", () => {
    const segments = segmentRegulations([
      {
        id: "reg-1",
        title: "Verordening maatschappelijke ondersteuning en jeugdhulp gemeente Heumen 2026",
        content: "Artikel 1: Begripsbepalingen.\n\nArtikel 2: Doel van de ondersteuning.",
      },
    ]);

    expect(segments.map((s) => s.id)).toEqual(["V1-1", "V1-2"]);
    expect(segments[0]?.text).toBe("Artikel 1: Begripsbepalingen.");
    expect(segments[1]?.text).toBe("Artikel 2: Doel van de ondersteuning.");
    expect(segments.every((s) => s.sourceLabel.includes("Heumen"))).toBe(true);
  });

  it("nummert meerdere verordeningen los door (V1-.. / V2-..)", () => {
    const segments = segmentRegulations([
      { id: "reg-1", title: "Verordening A", content: "Eerste alinea A." },
      { id: "reg-2", title: "Verordening B", content: "Eerste alinea B.\n\nTweede alinea B." },
    ]);

    expect(segments.map((s) => s.id)).toEqual(["V1-1", "V2-1", "V2-2"]);
  });

  it("geeft een lege lijst voor een lege input", () => {
    expect(segmentRegulations([])).toEqual([]);
  });

  it("valt terug op regel-per-regel als er geen dubbele newlines zijn", () => {
    const segments = segmentRegulations([
      { id: "reg-1", title: "Verordening C", content: "Regel 1\nRegel 2\nRegel 3" },
    ]);
    expect(segments.map((s) => s.id)).toEqual(["V1-1", "V1-2", "V1-3"]);
  });
});
