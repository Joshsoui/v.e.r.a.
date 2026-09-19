import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession, requireBeheerder } from "@/lib/auth/guard";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession(req);
    requireBeheerder(session);
    const { id } = await params;

    // Generieke 404 i.p.v. 403 bij een verordening van een andere
    // organisatie — voorkomt dat het bestaan van andermans records lekt
    // (zelfde IDOR-patroon als elders in de app, zie getReportOrThrow).
    const regulation = await prisma.regulation.findFirst({
      where: { id, organizationId: session.organizationId },
    });
    if (!regulation) {
      throw new ApiError(404, "Niet gevonden.");
    }

    await prisma.regulation.delete({ where: { id: regulation.id } });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "regulation.delete",
      entityType: "Regulation",
      entityId: regulation.id,
      ipHash: hashIp(getClientIp(req)),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
