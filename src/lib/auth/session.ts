import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { env } from "@/lib/env";

export type Role = "MEDEWERKER" | "BEHEERDER";

export type SessionPayload = {
  userId: string;
  organizationId: string;
  role: Role;
};

const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 uur

function secretKey() {
  return new TextEncoder().encode(env.authSecret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.userId === "string" &&
      typeof payload.organizationId === "string" &&
      (payload.role === "MEDEWERKER" || payload.role === "BEHEERDER")
    ) {
      return {
        userId: payload.userId,
        organizationId: payload.organizationId,
        role: payload.role,
      };
    }
    return null;
  } catch {
    return null;
  }
}

const cookieBaseOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax" as const,
  path: "/",
};

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(env.authCookieName, token, {
    ...cookieBaseOptions,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(env.authCookieName, "", { ...cookieBaseOptions, maxAge: 0 });
}

export function setCsrfCookie(res: NextResponse, token: string) {
  res.cookies.set(env.csrfCookieName, token, {
    httpOnly: false, // client-JS moet dit kunnen lezen voor het double-submit-patroon
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearCsrfCookie(res: NextResponse) {
  res.cookies.set(env.csrfCookieName, "", {
    httpOnly: false,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Alleen te gebruiken in Server Components / Route Handlers (GET). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(env.authCookieName)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
