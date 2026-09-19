import { describe, it, expect } from "vitest";
import { looksLikeHeadingText } from "@/lib/docx/headingHeuristics";

describe("looksLikeHeadingText", () => {
  it("accepteert korte titel-achtige tekst", () => {
    expect(looksLikeHeadingText("Aanleiding")).toBe(true);
    expect(looksLikeHeadingText("Conclusie en vervolgadvies")).toBe(true);
  });

  it("accepteert een vraag (eindigt op '?')", () => {
    expect(looksLikeHeadingText("Wat is de hulpvraag?")).toBe(true);
  });

  it("accepteert tekst die eindigt op ':' — een label/vraag-intro, geen afgeronde zin", () => {
    expect(looksLikeHeadingText("Kunnen de problemen opgelost worden door:")).toBe(true);
  });

  it("wijst een afgeronde mededelingszin af (eindigt op '.')", () => {
    expect(looksLikeHeadingText("Dit is een gewone zin in de brontekst.")).toBe(false);
  });

  it("wijst tekst af die eindigt op ',' of ';'", () => {
    expect(looksLikeHeadingText("Een opsomming,")).toBe(false);
    expect(looksLikeHeadingText("Een lijstje;")).toBe(false);
  });

  it("wijst een tussen haakjes geplaatste kanttekening af", () => {
    expect(looksLikeHeadingText("(Alleen indien van toepassing bij bezwaar)")).toBe(false);
    expect(looksLikeHeadingText("[intern gebruik]")).toBe(false);
  });

  it("staat een titel toe die zelf haakjes bevat, zolang hij er niet mee begint", () => {
    expect(looksLikeHeadingText("Doelen (alleen van toepassing bij begeleiding)")).toBe(true);
  });

  it("wijst losse nummering af", () => {
    expect(looksLikeHeadingText("12")).toBe(false);
  });

  it("wijst te lange tekst af (langer dan 90 tekens)", () => {
    expect(looksLikeHeadingText("x".repeat(91))).toBe(false);
  });

  it("wijst lege tekst af", () => {
    expect(looksLikeHeadingText("   ")).toBe(false);
  });
});
