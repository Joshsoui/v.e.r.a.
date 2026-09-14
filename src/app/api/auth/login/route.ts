import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie, setCsrfCookie } from "@/lib/auth/session";
import { generateCsrfToken, verifyCsrf } from "@/lib/auth/csrf";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError, rateLimitedResponse } from "@/lib/utils/errors";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) {
      throw new ApiError(403, "Ongeldige of ontbrekende CSRF-token.");
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`login:${ip ?? "onbekend"}`, env.rateLimitAuthMax, env.rateLimitAuthWindowMs);
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs);

    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Ongeldige invoer.");
    }
    const { email, password } = parsed.data;

    // Bewust dezelfde generieke foutmelding voor "onbekend e-mailadres" en
    // "onjuist wachtwoord" — anders kan een aanvaller e-mailadressen raden.
    const invalidCredentials = () => new ApiError(401, "Onjuiste inloggegevens.");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw invalidCredentials();
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await writeAuditLog({
        organizationId: user.organizationId,
        userId: user.id,
        action: "auth.login_failed",
        ipHash: hashIp(ip),
      });
      throw invalidCredentials();
    }

    const token = await createSessionToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    setSessionCookie(res, token);
    setCsrfCookie(res, generateCsrfToken());

    await writeAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "auth.login",
      ipHash: hashIp(ip),
    });

    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
