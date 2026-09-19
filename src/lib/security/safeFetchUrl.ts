// SSRF-veilige URL-fetch: haalt een door de gebruiker opgegeven URL server-
// side op (nodig voor "verordening toevoegen via URL", zie
// src/lib/regulations/) zonder dat een organisatielid daarmee de server kan
// misbruiken om interne netwerkadressen te bereiken (localhost, RFC1918-
// ranges, cloud-metadata-endpoints zoals 169.254.169.254, enz.).
//
// Verdedigingslagen:
// - alleen http(s), geen credentials in de URL;
// - het hostname wordt zelf ge-DNS-resolved en ELK teruggegeven IP-adres
//   wordt tegen de private/reserved-ranges gecontroleerd — dit vangt ook
//   een publieke hostnaam die (bewust of per ongeluk) naar een privé-adres
//   wijst, en alternatieve IP-notaties (hex/octaal) omdat die via de
//   resolver alsnog als een "normaal" IP-adres terugkomen;
// - redirects worden NOOIT automatisch gevolgd door fetch() zelf — elke hop
//   wordt opnieuw door dezelfde validatie gehaald (voorkomt dat een
//   toegestane publieke URL doorverwijst naar een intern adres);
// - timeout + een harde cap op de gedownloade hoeveelheid bytes.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafeUrlError extends Error {}

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 15_000;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true; // niet te parsen -> voor de zekerheid afwijzen
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud-metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast/gereserveerd
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (/^f[cd][0-9a-f]{0,2}:/.test(lower)) return true; // fc00::/7 (unique local)
  const v4Mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (v4Mapped?.[1]) return isPrivateIPv4(v4Mapped[1]);
  return false;
}

/** Ge-exporteerd voor directe unit-tests (zie tests/safe-fetch-url.test.ts). */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // geen geldig IP -> defensief afwijzen
}

async function assertPublicHostname(hostname: string): Promise<void> {
  if (hostname === "localhost") {
    throw new UnsafeUrlError("localhost is niet toegestaan.");
  }
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UnsafeUrlError(`Adres ${hostname} is een privé/lokaal netwerkadres en niet toegestaan.`);
    }
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError(`Kon het adres van "${hostname}" niet achterhalen.`);
  }
  if (addresses.length === 0) {
    throw new UnsafeUrlError(`Geen IP-adres gevonden voor "${hostname}".`);
  }
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new UnsafeUrlError(`"${hostname}" wijst naar een privé/lokaal netwerkadres en is niet toegestaan.`);
    }
  }
}

export type SafeFetchResult = { finalUrl: string; contentType: string; body: string };

/**
 * Haalt een URL veilig op als tekst (html/plain). Volgt redirects handmatig
 * (max MAX_REDIRECTS) en valideert elke tussenliggende URL opnieuw.
 */
export async function fetchUrlSafely(rawUrl: string): Promise<SafeFetchResult> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new UnsafeUrlError("Ongeldige URL.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new UnsafeUrlError("Alleen http(s)-URL's zijn toegestaan.");
    }
    if (parsed.username || parsed.password) {
      throw new UnsafeUrlError("URL's met inloggegevens zijn niet toegestaan.");
    }
    await assertPublicHostname(parsed.hostname);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(parsed, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "VERA-verordening-import/1.0" },
      });
    } catch {
      throw new UnsafeUrlError("Kon de URL niet ophalen (netwerkfout of timeout).");
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new UnsafeUrlError("Doorverwijzing zonder bestemmings-adres.");
      current = new URL(location, parsed).toString();
      continue;
    }

    if (!response.ok) {
      throw new UnsafeUrlError(`Ophalen mislukt (status ${response.status}).`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
      throw new UnsafeUrlError(`Onverwacht bestandstype: ${contentType || "onbekend"}.`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new UnsafeUrlError("Geen inhoud ontvangen.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          throw new UnsafeUrlError("De pagina is te groot om te verwerken (limiet 2 MB).");
        }
        chunks.push(value);
      }
    }
    const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
    return { finalUrl: parsed.toString(), contentType, body };
  }

  throw new UnsafeUrlError("Te veel doorverwijzingen.");
}
