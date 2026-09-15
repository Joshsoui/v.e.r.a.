// Gedeeld criterium voor het herkennen van een "kop-achtige" tekstregel
// wanneer een sjabloon geen echte Word-kopstijlen gebruikt (bv. handmatig
// vetgedrukte titels i.p.v. de ingebouwde Kop 1/Kop 2-stijl).
//
// Gebruikt op twee plekken die exact hetzelfde criterium moeten hanteren:
// - src/lib/formats/templateExtraction.ts: bepaalt bij sjabloon-upload welke
//   vetgedrukte paragrafen als hoofdstuktitel gelden.
// - src/lib/docx/fillTemplate.ts: moet diezelfde titels bij export in het
//   originele sjabloon terugvinden om de inhoud op de juiste plek te zetten.
// Zouden deze twee plekken een verschillend criterium hanteren, dan zou een
// bij upload herkend hoofdstuk bij export niet meer terug te vinden zijn.
export function looksLikeHeadingText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 90) return false;
  // Een kop is een korte titel, geen afgeronde zin.
  if (/[.,;:]$/.test(trimmed)) return false;
  // Losse nummering (bv. een paginanummer of lijstmarkering) is geen kop.
  if (/^\d+$/.test(trimmed)) return false;
  return true;
}
