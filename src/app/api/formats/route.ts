import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { unauthorizedResponse, handleApiError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

/**
 * Levert de volledige, actieve configuratieboom (vakgebied -> documenttype ->
 * formats) voor stap 1 van de workflow. Formats zijn geen organisatie-
 * gebonden data (geen dossierinhoud), dus geen org-filtering nodig — enkel
 * een geldige sessie.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const disciplines = await prisma.discipline.findMany({
      orderBy: { name: "asc" },
      include: {
        documentTypes: {
          orderBy: { name: "asc" },
          include: {
            formatTemplates: {
              orderBy: [{ isDefault: "desc" }, { name: "asc" }],
            },
          },
        },
      },
    });

    return NextResponse.json({ disciplines });
  } catch (err) {
    return handleApiError(err);
  }
}
