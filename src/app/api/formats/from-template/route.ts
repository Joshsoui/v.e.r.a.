import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guard";
import { assertValidUploadFile, UploadValidationException } from "@/lib/upload/validate";
import { extractHeadingsFromDocxWithFallback, headingsToChapterDefinitions } from "@/lib/formats/templateExtraction";
import { defaultWritingStyles, buildGenericValidatorRules } from "@/lib/formats/defaults";
import { writeAuditLog, hashIp, getClientIp } from "@/lib/security/audit";
import { ApiError, handleApiError, jsonError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

/**
 * Genereert een nieuwe, organisatie-eigen FormatTemplate uit een geüpload
 * .docx-sjabloon: de Word-koppen (Kop 1/2/3) worden de hoofdstukken. Zo kan
 * een gemeente haar eigen documentsjabloon uploaden en wordt dát de
 * structuur waarin de AI de brontekst opmaakt — met dezelfde
 * zero-fabrication-waarborgen als elk ander format, want het resultaat is
 * gewoon een normale FormatTemplate.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);

    const formData = await req.formData();
    const file = formData.get("file");
    const name = formData.get("name");
    const documentTypeId = formData.get("documentTypeId");

    if (!(file instanceof File)) {
      throw new ApiError(400, "Geen bestand aangeleverd.");
    }
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new ApiError(400, "Geef dit format een naam.");
    }
    if (typeof documentTypeId !== "string" || documentTypeId.trim().length === 0) {
      throw new ApiError(400, "Kies eerst een vakgebied en documenttype.");
    }

    assertValidUploadFile({ size: file.size, type: file.type, name: file.name });

    const documentType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
    if (!documentType) {
      throw new ApiError(400, "Onbekend documenttype.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { headings, usedFallback } = await extractHeadingsFromDocxWithFallback(buffer);
    const chapters = headingsToChapterDefinitions(headings);

    if (chapters.length < 2) {
      throw new ApiError(
        400,
        "Kon geen hoofdstukstructuur uit dit sjabloon halen. Zorg dat de kopjes in het " +
          "Word-document zijn opgemaakt met een kopstijl (Kop 1/Kop 2), of anders als losse, " +
          "volledig vetgedrukte titelregel (bv. \"1. Aanleiding\").",
      );
    }

    const chapterKeys = chapters.map((c) => c.key);
    const formatTemplate = await prisma.formatTemplate.create({
      data: {
        documentTypeId: documentType.id,
        organizationId: session.organizationId,
        name: name.trim().slice(0, 200),
        isDefault: false,
        chapters,
        writingStyles: defaultWritingStyles,
        validatorRules: buildGenericValidatorRules(chapterKeys),
        // Het originele sjabloon zelf bewaren (logo/huisstijl/opmaak) zodat de
        // export dit document kan hergebruiken in plaats van een generiek
        // document te genereren — zie src/lib/docx/fillTemplate.ts.
        sourceDocx: buffer,
      },
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "format.create_from_template",
      entityType: "FormatTemplate",
      entityId: formatTemplate.id,
      ipHash: hashIp(getClientIp(req)),
    });

    return NextResponse.json(
      { formatTemplate: { id: formatTemplate.id, name: formatTemplate.name, chapters }, usedFallback },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof UploadValidationException) {
      return jsonError(400, err.message);
    }
    return handleApiError(err);
  }
}
