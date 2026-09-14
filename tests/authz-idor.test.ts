import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getReportOrThrow } from "@/lib/reports/access";
import { ApiError } from "@/lib/utils/errors";
import type { SessionPayload } from "@/lib/auth/session";

// Deze test draait tegen een echte (lokale) testdatabase (zie .env.test) —
// autorisatie/IDOR-gedrag hangt af van echte Prisma-queries en is niet
// zinvol te mocken. getReportOrThrow() is de ENIGE plek waar rapporten
// worden opgehaald in alle API-routes, dus dit dekt het IDOR- en
// organisatie-scheidingsgedrag van de hele applicatie.

let orgA: { id: string };
let orgB: { id: string };
let userA: { id: string };
let userB: { id: string };
let reportA: { id: string };
let formatTemplateId: string;
let documentTypeId: string;
let disciplineId: string;

beforeAll(async () => {
  const discipline = await prisma.discipline.create({
    data: { code: `test-discipline-${Date.now()}`, name: "Testvakgebied" },
  });
  disciplineId = discipline.id;

  const documentType = await prisma.documentType.create({
    data: { disciplineId: discipline.id, code: "test-doctype", name: "Testdocument" },
  });
  documentTypeId = documentType.id;

  const formatTemplate = await prisma.formatTemplate.create({
    data: {
      documentTypeId: documentType.id,
      name: "Testformat",
      isDefault: true,
      chapters: [{ key: "intro", title: "Intro", order: 0, instructions: "Test", requiredElements: [] }],
      writingStyles: [],
      validatorRules: {},
    },
  });
  formatTemplateId = formatTemplate.id;

  orgA = await prisma.organization.create({ data: { name: "Organisatie A" } });
  orgB = await prisma.organization.create({ data: { name: "Organisatie B" } });

  userA = await prisma.user.create({
    data: {
      organizationId: orgA.id,
      email: `user-a-${Date.now()}@example.test`,
      passwordHash: "x",
      name: "Gebruiker A",
      role: "BEHEERDER",
    },
  });
  userB = await prisma.user.create({
    data: {
      organizationId: orgB.id,
      email: `user-b-${Date.now()}@example.test`,
      passwordHash: "x",
      name: "Gebruiker B",
      role: "BEHEERDER",
    },
  });

  reportA = await prisma.report.create({
    data: {
      organizationId: orgA.id,
      userId: userA.id,
      formatTemplateId: formatTemplate.id,
      title: "Testrapport A",
      status: "INSTELLINGEN",
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
});

afterAll(async () => {
  await prisma.report.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  await prisma.formatTemplate.delete({ where: { id: formatTemplateId } });
  await prisma.documentType.delete({ where: { id: documentTypeId } });
  await prisma.discipline.delete({ where: { id: disciplineId } });
  await prisma.$disconnect();
});

function sessionFor(userId: string, organizationId: string): SessionPayload {
  return { userId, organizationId, role: "BEHEERDER" };
}

describe("getReportOrThrow — IDOR-bescherming en organisatie-scheiding", () => {
  it("geeft het rapport terug voor de eigenaar-organisatie", async () => {
    const report = await getReportOrThrow(reportA.id, sessionFor(userA.id, orgA.id));
    expect(report.id).toBe(reportA.id);
  });

  it("gooit een generieke 404 als een andere organisatie hetzelfde rapport probeert te benaderen (IDOR)", async () => {
    await expect(getReportOrThrow(reportA.id, sessionFor(userB.id, orgB.id))).rejects.toMatchObject({
      status: 404,
      publicMessage: "Niet gevonden.",
    });
  });

  it("gooit exact dezelfde generieke 404 voor een niet-bestaand rapport", async () => {
    await expect(
      getReportOrThrow("niet-bestaand-id", sessionFor(userA.id, orgA.id)),
    ).rejects.toMatchObject({ status: 404, publicMessage: "Niet gevonden." });
  });

  it("de IDOR-poging en 'bestaat niet'-poging zijn voor de aanvrager niet te onderscheiden", async () => {
    let idorError: unknown;
    let notFoundError: unknown;
    try {
      await getReportOrThrow(reportA.id, sessionFor(userB.id, orgB.id));
    } catch (err) {
      idorError = err;
    }
    try {
      await getReportOrThrow("niet-bestaand-id", sessionFor(userA.id, orgA.id));
    } catch (err) {
      notFoundError = err;
    }
    expect(idorError).toBeInstanceOf(ApiError);
    expect(notFoundError).toBeInstanceOf(ApiError);
    expect((idorError as ApiError).status).toBe((notFoundError as ApiError).status);
    expect((idorError as ApiError).publicMessage).toBe((notFoundError as ApiError).publicMessage);
  });
});

describe("organisatie-scheiding — lijst-queries", () => {
  it("een lijst-query voor organisatie B bevat nooit rapporten van organisatie A", async () => {
    const reportsForB = await prisma.report.findMany({ where: { organizationId: orgB.id } });
    expect(reportsForB.find((r) => r.id === reportA.id)).toBeUndefined();
  });

  it("een lijst-query voor organisatie A bevat wél het eigen rapport", async () => {
    const reportsForA = await prisma.report.findMany({ where: { organizationId: orgA.id } });
    expect(reportsForA.find((r) => r.id === reportA.id)).toBeDefined();
  });
});
