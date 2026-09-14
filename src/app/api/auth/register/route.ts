import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { registerSchema } from "@/lib/validation/auth";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/password";
import {
  createSessionToken,
  setSessionCookie,
  setCsrfCookie,
} from "@/lib/auth/session";
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
    const rl = checkRateLimit(`register:${ip ?? "onbekend"}`, env.rateLimitAuthMax, env.rateLimitAuthWindowMs);
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs);

    const body = await req.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Ongeldige invoer. Controleer alle velden.");
    }
    const { organizationName, municipality, name, email, password } = parsed.data;

    if (!isPasswordStrongEnough(password)) {
      throw new ApiError(400, "Wachtwoord moet minimaal 10 tekens bevatten.");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, "Dit e-mailadres is al in gebruik.");
    }

    const passwordHash = await hashPassword(password);

    const { organization, user } = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: organizationName, municipality: municipality || null },
      });
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email,
          passwordHash,
          name,
          role: "BEHEERDER",
        },
      });
      return { organization, user };
    });

    const token = await createSessionToken({
      userId: user.id,
      organizationId: organization.id,
      role: user.role,
    });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization: {
        id: organization.id,
        name: organization.name,
        municipality: organization.municipality,
      },
    });
    setSessionCookie(res, token);
    setCsrfCookie(res, generateCsrfToken());

    await writeAuditLog({
      organizationId: organization.id,
      userId: user.id,
      action: "auth.register",
      entityType: "User",
      entityId: user.id,
      ipHash: hashIp(ip),
    });

    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
