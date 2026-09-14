import { describe, it, expect } from "vitest";
import { generateReportDocx } from "@/lib/docx/export";

describe("generateReportDocx", () => {
  it("genereert een geldig .docx-bestand (Office Open XML / ZIP-package)", async () => {
    const buffer = await generateReportDocx({
      documentTypeName: "Onderzoeksverslag",
      formatName: "Standaardformat",
      organizationName: "Gemeente Teststad",
      municipality: "Teststad",
      title: "Onderzoeksverslag — 14-09-2026",
      version: 1,
      addChecklist: true,
      addConceptFootnote: true,
      generatedAt: new Date("2026-09-14T10:00:00Z"),
      chapters: [
        {
          title: "Aanleiding en vraagstelling",
          status: "COMPLEET",
          missingInfo: [],
          statements: [
            {
              id: "s1",
              text: "De school heeft een zorgmelding gedaan.",
              category: "FEIT",
              sourceRefs: ["B1-1"],
              origin: "AI",
              sourceVerified: true,
            },
          ],
        },
        {
          title: "Conclusie en vervolgadvies",
          status: "ONVOLLEDIG",
          missingInfo: ["Vervolgadvies ontbreekt nog."],
          statements: [],
        },
      ],
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // .docx is een ZIP-package; een geldig bestand begint met de ZIP local
    // file header magic bytes "PK\x03\x04".
    expect(buffer.subarray(0, 4).toString("hex")).toBe("504b0304");
  });

  it("genereert ook een geldig document zonder checklist/voetnoot", async () => {
    const buffer = await generateReportDocx({
      documentTypeName: "Onderzoeksverslag",
      formatName: "Standaardformat",
      organizationName: "Gemeente Teststad",
      municipality: null,
      title: "Onderzoeksverslag — 14-09-2026",
      version: 2,
      addChecklist: false,
      addConceptFootnote: false,
      generatedAt: new Date(),
      chapters: [
        { title: "Hoofdstuk zonder inhoud", status: "NIET_GECONTROLEERD", missingInfo: [], statements: [] },
      ],
    });
    expect(buffer.subarray(0, 4).toString("hex")).toBe("504b0304");
  });
});
