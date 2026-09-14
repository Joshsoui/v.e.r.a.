import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

/**
 * Hasht een IP-adres onomkeerbaar (SHA-256, met een geheime pepper uit
 * AUTH_SECRET zodat het niet trivieel terug te rainbow-tablen is). We slaan
 * nooit een raw IP op.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const pepper = process.env.AUTH_SECRET ?? "vera";
  return createHash("sha256").update(`${pepper}:${ip}`).digest("hex");
}

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return null;
}

export type AuditAction =
  | "auth.register"
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.password_reset_requested"
  | "auth.password_reset_completed"
  | "report.create"
  | "report.update_settings"
  | "report.sources_upload"
  | "report.ai_analyze"
  | "report.chapter_update"
  | "report.export"
  | "format.create_from_template"
  | "report.delete"
  | "account.data_delete";

type AuditEntry = {
  organizationId: string;
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  ipHash?: string | null;
};

/**
 * Schrijft een audit-logregel. Bevat UITDRUKKELIJK NOOIT dossierinhoud —
 * alleen actie, entiteitstype/-id en (gehashte) metadata.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        ipHash: entry.ipHash ?? null,
      },
    });
  } catch (err) {
    // Audit-logging mag een user-facing request nooit laten falen.
    console.error("Kon audit-logregel niet wegschrijven:", err);
  }
}
