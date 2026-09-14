import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guard";
import { getReportOrThrow } from "@/lib/reports/access";
import { ApiError, handleApiError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; sourceId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id, sourceId } = await params;
    const report = await getReportOrThrow(id, session);

    // Ook hier: generieke 404 als de bron niet (meer) bij dit rapport hoort.
    const source = report.sources.find((s) => s.id === sourceId);
    if (!source) {
      throw new ApiError(404, "Niet gevonden.");
    }

    await prisma.sourceDocument.delete({ where: { id: source.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
