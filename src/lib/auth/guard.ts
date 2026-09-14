import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/utils/errors";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";

/**
 * Verplicht een geldige sessie voor een Route Handler. Voor state-wijzigende
 * methodes (alles behalve GET/HEAD/OPTIONS) wordt ook de CSRF-token
 * gecontroleerd (double-submit-cookiepatroon).
 */
export async function requireSession(req: NextRequest): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new ApiError(401, "Niet ingelogd.");
  }
  if (!verifyCsrf(req)) {
    throw new ApiError(403, "Ongeldige of ontbrekende CSRF-token.");
  }
  return session;
}

export function requireBeheerder(session: SessionPayload): void {
  if (session.role !== "BEHEERDER") {
    throw new ApiError(403, "Deze actie is voorbehouden aan beheerders.");
  }
}
