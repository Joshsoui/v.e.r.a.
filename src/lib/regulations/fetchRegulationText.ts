import { fetchUrlSafely, UnsafeUrlError } from "@/lib/security/safeFetchUrl";
import { extractTextFromHtml } from "@/lib/regulations/htmlToText";

export { UnsafeUrlError };

// Harde bovengrens op de opgeslagen tekst van één verordening — voorkomt dat
// een extreem lange pagina de AI-prompt onbeheersbaar groot maakt. Een
// verordening is doorgaans een paar duizend tot een paar tienduizend tekens.
const MAX_REGULATION_CHARS = 80_000;

/**
 * Haalt een verordeningspagina veilig op (zie safeFetchUrl.ts voor de
 * SSRF-waarborgen) en zet de HTML om in platte tekst, klaar om als
 * Regulation.content op te slaan.
 */
export async function fetchRegulationTextFromUrl(url: string): Promise<string> {
  const { body, contentType } = await fetchUrlSafely(url);
  const text = /text\/html|application\/xhtml\+xml/i.test(contentType) ? extractTextFromHtml(body) : body.trim();

  if (text.length === 0) {
    throw new UnsafeUrlError("Er kon geen leesbare tekst uit deze pagina gehaald worden.");
  }
  return text.length > MAX_REGULATION_CHARS
    ? text.slice(0, MAX_REGULATION_CHARS) + "\n\n[…ingekort, tekst was langer dan de limiet…]"
    : text;
}
