import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { unauthorizedResponse, handleApiError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

/**
 * Levert de volledige, actieve configuratieboom (vakgebied -> documenttype ->
 * formats) voor stap 1 van de workflow. Formats zijn in principe gedeelde
 * configuratie (geen dossierinhoud), behalve uit een sjabloon gegenereerde
 * formats (FormatTemplate.organizationId) — die zijn privé per organisatie,
 * dus hier gescoped op sessie.
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
              where: {
                OR: [{ organizationId: null }, { organizationId: session.organizationId }],
              },
              orderBy: [{ isDefault: "desc" }, { name: "asc" }],
              // sourceDocx kan enkele honderden KB's binaire data zijn en is
              // hier niet nodig (alleen relevant bij export) — nooit
              // meesturen in deze lijst-respons.
              omit: { sourceDocx: true },
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
