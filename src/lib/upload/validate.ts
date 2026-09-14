import { env } from "@/lib/env";

export type UploadValidationError =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "TOO_MANY_FILES"
  | "EMPTY_TEXT"
  | "TOTAL_INPUT_TOO_LONG";

export class UploadValidationException extends Error {
  constructor(public readonly code: UploadValidationError, message: string) {
    super(message);
  }
}

const ALLOWED_DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function assertValidUploadFile(file: { size: number; type: string; name: string }) {
  if (file.size > env.maxUploadFileSizeBytes) {
    throw new UploadValidationException(
      "FILE_TOO_LARGE",
      `Bestand "${file.name}" is te groot (max. ${Math.round(env.maxUploadFileSizeBytes / 1_000_000)} MB).`,
    );
  }
  const isDocx =
    ALLOWED_DOCX_MIME_TYPES.has(file.type) || file.name.toLowerCase().endsWith(".docx");
  if (!isDocx) {
    throw new UploadValidationException(
      "UNSUPPORTED_TYPE",
      `Bestandstype van "${file.name}" wordt niet ondersteund. Alleen .docx wordt geaccepteerd.`,
    );
  }
}

export function assertWithinFileCount(currentCount: number, addingCount: number) {
  if (currentCount + addingCount > env.maxSourceFilesPerReport) {
    throw new UploadValidationException(
      "TOO_MANY_FILES",
      `Maximaal ${env.maxSourceFilesPerReport} brondocumenten per verslag toegestaan.`,
    );
  }
}

export function assertNonEmptyText(text: string, label: string) {
  if (text.trim().length === 0) {
    throw new UploadValidationException("EMPTY_TEXT", `${label} bevat geen tekst.`);
  }
}

export function assertTotalInputWithinLimit(totalChars: number) {
  if (totalChars > env.maxTotalInputChars) {
    throw new UploadValidationException(
      "TOTAL_INPUT_TOO_LONG",
      `De totale hoeveelheid brontekst overschrijdt de limiet van ${env.maxTotalInputChars.toLocaleString("nl-NL")} tekens. Verwijder een deel van de brontekst.`,
    );
  }
}
