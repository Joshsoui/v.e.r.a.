import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Content-Security-Policy met een per-request nonce. Next.js' App Router
// injecteert zelf inline <script>-tags (voor de RSC-hydratatiepayload) die
// zonder nonce door een strikte `script-src 'self'` geblokkeerd worden —
// daarmee hydrateert de pagina nooit en reageert geen enkele knop. Next.js
// herkent automatisch de nonce in de Content-Security-Policy-header en past
// die toe op zijn eigen inline scripts, zolang we 'm ook als `x-nonce`
// request-header doorgeven.
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isProd = process.env.NODE_ENV === "production";

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
    isProd ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Alles behalve statische assets en afbeeldingen — die hebben geen CSP/nonce nodig.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
