// Zet de HTML van een (verordenings)pagina om in platte tekst. Bewust een
// lichtgewicht regex-aanpak — consistent met de rest van de codebase (zie
// src/lib/formats/templateExtraction.ts) — in plaats van een volwaardige
// HTML-parser: we hebben alleen de leesbare tekst nodig, geen structuur.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  eacute: "é",
  egrave: "è",
  euml: "ë",
  euro: "€",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (entity.startsWith("#")) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    const lower = entity.toLowerCase();
    return NAMED_ENTITIES[lower] ?? match;
  });
}

export function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  text = decodeHtmlEntities(text);

  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, i, all) => line.length > 0 || (all[i - 1]?.length ?? 0) > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
