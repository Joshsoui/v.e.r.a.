import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { consumePasswordResetToken } from "@/lib/auth/passwordReset";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/password";
import { verifyCsrf } from "@/lib/auth/csrf";
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
    const rl = checkRateLimit(`reset-password:${ip ?? "onbekend"}`, env.rateLimitAuthMax, env.rateLimitAuthWindowMs);
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs);

    const body = await req.json().catch(() => null);
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Ongeldige invoer.");
    }

    if (!isPasswordStrongEnough(parsed.data.password)) {
      throw new ApiError(400, "Wachtwoord moet minimaal 10 tekens bevatten.");
    }

    const userId = await consumePasswordResetToken(parsed.data.token);
    if (!userId) {
      throw new ApiError(400, "Deze resetlink is ongeldig of verlopen. Vraag een nieuwe aan.");
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await writeAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "auth.password_reset_completed",
      entityType: "User",
      entityId: user.id,
      ipHash: hashIp(ip),
    });

    return NextResponse.json({ message: "Wachtwoord succesvol gewijzigd. Je kunt nu inloggen." });
  } catch (err) {
    return handleApiError(err);
  }
}
