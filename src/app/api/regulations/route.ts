import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession, requireBeheerder } from "@/lib/auth/guard";
import { createRegulationSchema } from "@/lib/validation/regulations";
import { fetchRegulationTextFromUrl, UnsafeUrlError } from "@/lib/regulations/fetchRegulationText";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError, rateLimitedResponse } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

const REGULATION_RATE_LIMIT_MAX = 20;
const REGULATION_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Verordeningen zijn organisatie-CONFIGURATIE (zie Regulation in
 * schema.prisma) — permanente juridische referentietekst die de AI mag
 * citeren ter ondersteuning van een professionele duiding, nooit als bron
 * voor casusfeiten. Lezen mag elk organisatielid (nodig voor een correcte
 * VERA-analyse); toevoegen/verwijderen is voorbehouden aan beheerders, mede
 * omdat toevoegen-via-URL de server een externe pagina laat ophalen (zie
 * fetchRegulationTextFromUrl / safeFetchUrl.ts voor de SSRF-waarborgen).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const regulations = await prisma.regulation.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, sourceUrl: true, content: true, createdAt: true },
    });
    return NextResponse.json({
      regulations: regulations.map((r) => ({
        id: r.id,
        title: r.title,
        sourceUrl: r.sourceUrl,
        charCount: r.content.length,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    requireBeheerder(session);

    const rl = checkRateLimit(
      `regulation:${session.userId}`,
      REGULATION_RATE_LIMIT_MAX,
      REGULATION_RATE_LIMIT_WINDOW_MS,
    );
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs);

    const body = await req.json().catch(() => null);
    const parsed = createRegulationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Ongeldige invoer.");
    }

    let content: string;
    if (parsed.data.sourceUrl) {
      try {
        content = await fetchRegulationTextFromUrl(parsed.data.sourceUrl);
      } catch (err) {
        if (err instanceof UnsafeUrlError) {
          throw new ApiError(400, `Kon de tekst niet ophalen: ${err.message}`);
        }
        throw err;
      }
    } else {
      content = parsed.data.content!;
    }

    const regulation = await prisma.regulation.create({
      data: {
        organizationId: session.organizationId,
        title: parsed.data.title,
        sourceUrl: parsed.data.sourceUrl ?? null,
        content,
      },
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "regulation.create",
      entityType: "Regulation",
      entityId: regulation.id,
      ipHash: hashIp(getClientIp(req)),
    });

    return NextResponse.json(
      {
        regulation: {
          id: regulation.id,
          title: regulation.title,
          sourceUrl: regulation.sourceUrl,
          charCount: regulation.content.length,
          createdAt: regulation.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
