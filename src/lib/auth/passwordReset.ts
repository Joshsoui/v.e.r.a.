import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 uur

export function generateResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** SHA-256 van het token — alleen deze hash komt in de database terecht. */
export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Maakt een nieuw resettoken voor deze gebruiker en invalideert eerdere,
 * nog niet gebruikte tokens (voorkomt dat oude, nog geldige links blijven
 * werken nadat iemand opnieuw "wachtwoord vergeten" heeft aangevraagd).
 * Geeft het RAW token terug — dat gaat in de resetlink, nooit in de database.
 */
export async function issuePasswordResetToken(userId: string): Promise<string> {
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  const rawToken = generateResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return rawToken;
}

/**
 * Valideert en verbruikt een resettoken (eenmalig — markeert het meteen als
 * gebruikt). Geeft de userId terug bij een geldig, nog niet verlopen en nog
 * niet gebruikt token, anders null.
 */
export async function consumePasswordResetToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashResetToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt !== null || record.expiresAt <= new Date()) {
    return null;
  }
  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.userId;
}
