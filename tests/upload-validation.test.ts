import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  assertValidUploadFile,
  assertWithinFileCount,
  assertNonEmptyText,
  assertTotalInputWithinLimit,
  UploadValidationException,
} from "@/lib/upload/validate";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.MAX_UPLOAD_FILE_SIZE_BYTES = "1000";
  process.env.MAX_SOURCE_FILES_PER_REPORT = "3";
  process.env.MAX_TOTAL_INPUT_CHARS = "500";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("assertValidUploadFile", () => {
  it("accepteert een geldig .docx-bestand binnen de groottelimiet", () => {
    expect(() =>
      assertValidUploadFile({
        size: 500,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        name: "notities.docx",
      }),
    ).not.toThrow();
  });

  it("weigert een te groot bestand", () => {
    expect(() =>
      assertValidUploadFile({ size: 10_000, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name: "groot.docx" }),
    ).toThrow(UploadValidationException);
  });

  it("weigert een niet-toegestaan bestandstype", () => {
    expect(() =>
      assertValidUploadFile({ size: 100, type: "application/pdf", name: "bestand.pdf" }),
    ).toThrow(UploadValidationException);
  });
});

describe("assertWithinFileCount", () => {
  it("staat toe binnen de limiet", () => {
    expect(() => assertWithinFileCount(1, 1)).not.toThrow();
  });

  it("weigert boven de limiet", () => {
    expect(() => assertWithinFileCount(2, 2)).toThrow(UploadValidationException);
  });
});

describe("assertNonEmptyText", () => {
  it("weigert lege of alleen-whitespace tekst", () => {
    expect(() => assertNonEmptyText("   ", "Tekst")).toThrow(UploadValidationException);
  });

  it("accepteert niet-lege tekst", () => {
    expect(() => assertNonEmptyText("hallo", "Tekst")).not.toThrow();
  });
});

describe("assertTotalInputWithinLimit", () => {
  it("weigert boven de totale-inputlimiet", () => {
    expect(() => assertTotalInputWithinLimit(501)).toThrow(UploadValidationException);
  });

  it("accepteert binnen de limiet", () => {
    expect(() => assertTotalInputWithinLimit(500)).not.toThrow();
  });
});
