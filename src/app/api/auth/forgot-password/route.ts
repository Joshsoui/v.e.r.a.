import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { issuePasswordResetToken } from "@/lib/auth/passwordReset";
import { verifyCsrf } from "@/lib/auth/csrf";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError, rateLimitedResponse } from "@/lib/utils/errors";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

// Let op: er is (nog) geen e-mailprovider aangesloten. De resetlink wordt
// hieronder naar de servers-logs geschreven (duidelijk gemarkeerd) zodat een
// beheerder hem tijdelijk handmatig kan doorgeven. Zodra een e-mailprovider
// gekozen is, vervang je het console.log-blok hieronder door een echte
// verzendaanroep — de rest van de flow (token, validatie, opnieuw instellen)
// hoeft dan niet te wijzigen.
function deliverResetLink(email: string, rawToken: string) {
  const resetUrl = `${env.appBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  console.log(
    `[wachtwoord-reset] Nog geen e-mailprovider aangesloten — geef deze link handmatig door aan ${email}: ${resetUrl}`,
  );
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
      deliverResetLink(user.email, rawToken);
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
