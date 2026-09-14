import mammoth from "mammoth";

/** Extraheert platte tekst uit een .docx-bestand (buffer). */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}
