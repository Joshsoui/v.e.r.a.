import { NextResponse } from "next/server";

/**
 * Fout met een bewust veilige, gebruiksvriendelijke boodschap die 1-op-1 naar
 * de client mag. Interne details horen in `cause`/server-logs, nooit in
 * `publicMessage`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly publicMessage: string;

  constructor(status: number, publicMessage: string, options?: { cause?: unknown }) {
    super(publicMessage, options);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Generieke 404 — ook voor IDOR-pogingen (org A mag nooit weten dat iets van org B bestaat). */
export function notFoundResponse() {
  return jsonError(404, "Niet gevonden.");
}

export function unauthorizedResponse() {
  return jsonError(401, "Niet ingelogd.");
}

export function forbiddenCsrfResponse() {
  return jsonError(403, "Ongeldige of ontbrekende CSRF-token.");
}

export function rateLimitedResponse(retryAfterMs: number) {
  const res = jsonError(429, "Te veel verzoeken. Probeer het later opnieuw.");
  res.headers.set("Retry-After", Math.ceil(retryAfterMs / 1000).toString());
  return res;
}

/**
 * Vangt onverwachte fouten af: logt het volledige detail server-side, geeft
 * de client alleen een generieke boodschap (nooit een stacktrace of interne
 * foutmelding — dat kan implementatiedetails of dossierinhoud lekken).
 */
export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return jsonError(err.status, err.publicMessage);
  }
  console.error("Onverwachte API-fout:", err);
  return jsonError(500, "Er is een onverwachte fout opgetreden.");
}
