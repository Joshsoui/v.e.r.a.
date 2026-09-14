import { NextResponse } from "next/server";
import { setCsrfCookie } from "@/lib/auth/session";
import { generateCsrfToken } from "@/lib/auth/csrf";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = generateCsrfToken();
  const res = NextResponse.json({ csrfToken: token });
  setCsrfCookie(res, token);
  return res;
}
