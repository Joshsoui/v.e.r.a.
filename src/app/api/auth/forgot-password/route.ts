import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { issuePasswordResetToken } from "@/lib/auth/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email/passwordResetEmail";
import { verifyCsrf } from "@/lib/auth/csrf";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError, rateLimitedResponse } from "@/lib/utils/errors";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

// Verstuurt de resetlink via Resend zodra RESEND_API_KEY geconfigureerd is.
// Is dat (nog) niet het geval, of mislukt de verzending, dan valt dit terug
// op het loggen van de link (duidelijk gemarkeerd) zodat een beheerder hem
// tijdelijk handmatig kan doorgeven — nooit een verloren resetverzoek.
async function deliverResetLink(email: string, rawToken: string) {
  const resetUrl = `${env.appBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const result = await sendPasswordResetEmail(email, resetUrl);
  if (result !== "sent") {
    const reason = result === "not_configured" ? "Nog geen e-mailprovider aangesloten" : "Verzenden via Resend is mislukt";
    console.log(`[wachtwoord-reset] ${reason} — geef deze link handmatig door aan ${email}: ${resetUrl}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) {
      throw new ApiError(403, "Ongeldige of ontbrekende CSRF-token.");
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`forgot-password:${ip ?? "onbekend"}`, env.rateLimitAuthMax, env.rateLimitAuthWindowMs);
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs);

    const body = await req.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Vul een geldig e-mailadres in.");
    }

    // Bewust ALTIJD dezelfde generieke respons, of het e-mailadres nu bestaat
    // of niet — anders kan een aanvaller e-mailadressen raden (net als bij
    // login, zie de opmerking daar).
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (user) {
      const rawToken = await issuePasswordResetToken(user.id);
      await deliverResetLink(user.email, rawToken);
      await writeAuditLog({
        organizationId: user.organizationId,
        userId: user.id,
        action: "auth.password_reset_requested",
        entityType: "User",
        entityId: user.id,
        ipHash: hashIp(ip),
      });
    }

    return NextResponse.json({
      message: "Als dit e-mailadres bekend is, is er een link klaargezet om je wachtwoord opnieuw in te stellen.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
