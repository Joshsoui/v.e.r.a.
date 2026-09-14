import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit-cookiepatroon: bij elke state-wijzigende request moet de
 * client de waarde van de (niet-httpOnly) csrf-cookie terugsturen in de
 * `x-csrf-token`-header. Een cross-site aanvaller kan de cookie niet lezen,
 * dus kan dit request niet vervalsen.
 */
export function verifyCsrf(req: NextRequest): boolean {
  if (SAFE_METHODS.has(req.method)) return true;

  const cookieToken = req.cookies.get(env.csrfCookieName)?.value;
  const headerToken = req.headers.get("x-csrf-token");

  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length !== headerToken.length) return false;

  try {
    return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
  } catch {
    return false;
  }
}
