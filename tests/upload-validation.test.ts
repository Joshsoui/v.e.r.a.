import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  assertValidUploadFile,
  assertValidAudioFile,
  isAudioUpload,
  assertWithinFileCount,
  assertNonEmptyText,
  assertTotalInputWithinLimit,
  UploadValidationException,
} from "@/lib/upload/validate";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.MAX_UPLOAD_FILE_SIZE_BYTES = "1000";
  process.env.MAX_AUDIO_FILE_SIZE_BYTES = "2000";
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

describe("isAudioUpload", () => {
  it("herkent audio op mime-type", () => {
    expect(isAudioUpload({ type: "audio/webm", name: "opname" })).toBe(true);
    expect(isAudioUpload({ type: "audio/mpeg", name: "gesprek" })).toBe(true);
  });

  it("herkent audio op bestandsextensie als het mime-type ontbreekt/generiek is", () => {
    expect(isAudioUpload({ type: "", name: "gesprek.m4a" })).toBe(true);
    expect(isAudioUpload({ type: "application/octet-stream", name: "opname.wav" })).toBe(true);
  });

  it("herkent video/webm ook als audio (MediaRecorder levert audio-only opnames soms zo aan)", () => {
    expect(isAudioUpload({ type: "video/webm", name: "opname.webm" })).toBe(true);
  });

  it("herkent een .docx-bestand niet als audio", () => {
    expect(isAudioUpload({ type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name: "notities.docx" })).toBe(false);
  });
});

describe("assertValidAudioFile", () => {
  it("accepteert een geldig audiobestand binnen de groottelimiet", () => {
    expect(() => assertValidAudioFile({ size: 1500, type: "audio/webm", name: "opname.webm" })).not.toThrow();
  });

  it("weigert een te groot audiobestand", () => {
    expect(() => assertValidAudioFile({ size: 5000, type: "audio/webm", name: "groot.webm" })).toThrow(
      UploadValidationException,
    );
  });

  it("weigert een niet-audio bestandstype", () => {
    expect(() => assertValidAudioFile({ size: 100, type: "application/pdf", name: "bestand.pdf" })).toThrow(
      UploadValidationException,
    );
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
