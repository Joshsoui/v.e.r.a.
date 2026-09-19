import { describe, it, expect } from "vitest";
import { extractTextFromHtml } from "@/lib/regulations/htmlToText";

describe("extractTextFromHtml", () => {
  it("strip script- en style-tags volledig", () => {
    const html = "<html><head><style>.x{color:red}</style></head><body><script>alert(1)</script><p>Tekst</p></body></html>";
    const text = extractTextFromHtml(html);
    expect(text).toBe("Tekst");
  });

  it("zet blok-elementen om in regeleinden", () => {
    const html = "<div>Artikel 1</div><div>Artikel 2</div>";
    const text = extractTextFromHtml(html);
    expect(text.split("\n").map((l) => l.trim())).toEqual(["Artikel 1", "Artikel 2"]);
  });

  it("decodeert HTML-entities", () => {
    const html = "<p>Recht &amp; plicht &euml;&eacute;n samenhang</p>";
    const text = extractTextFromHtml(html);
    expect(text).toContain("Recht & plicht");
    expect(text).toContain("ëén samenhang");
  });

  it("decodeert numerieke entities (decimaal en hex)", () => {
    const html = "<p>&#65;&#x42;</p>";
    expect(extractTextFromHtml(html)).toBe("AB");
  });

  it("geeft lege string voor puur opmaak zonder tekst", () => {
    expect(extractTextFromHtml("<div><span></span></div>")).toBe("");
  });
});
