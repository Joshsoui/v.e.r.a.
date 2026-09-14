import { NextRequest, NextResponse } from "next/server";
import { getSession, clearSessionCookie, clearCsrfCookie } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { writeAuditLog } from "@/lib/security/audit";
import { ApiError, handleApiError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) {
      throw new ApiError(403, "Ongeldige of ontbrekende CSRF-token.");
    }
    const session = await getSession();
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    clearCsrfCookie(res);

    if (session) {
      await writeAuditLog({
        organizationId: session.organizationId,
        userId: session.userId,
        action: "auth.logout",
      });
    }

    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
