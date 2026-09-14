import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guard";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { handleApiError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

/**
 * Zelfbedieningsendpoint: verwijdert alle eigen rapporten (inclusief bronnen
 * en hoofdstukinhoud, via cascade) van de ingelogde gebruiker. Raakt nooit
 * data van collega's binnen dezelfde organisatie.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession(req);

    const { count } = await prisma.report.deleteMany({
      where: { userId: session.userId, organizationId: session.organizationId },
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "account.data_delete",
      ipHash: hashIp(getClientIp(req)),
    });

    return NextResponse.json({ ok: true, deletedReports: count });
  } catch (err) {
    return handleApiError(err);
  }
}
