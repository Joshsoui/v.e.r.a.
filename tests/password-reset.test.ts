import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  generateResetToken,
  hashResetToken,
  issuePasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/auth/passwordReset";

// Draait tegen de echte (lokale) testdatabase — het token-lifecycle-gedrag
// (eenmalig gebruik, invalidatie van oude tokens, verlopen tokens) hangt af
// van echte Prisma-queries en is niet zinvol te mocken.

let org: { id: string };
let user: { id: string };

beforeAll(async () => {
  org = await prisma.organization.create({ data: { name: "Organisatie Reset" } });
  user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `user-reset-${Date.now()}@example.test`,
      passwordHash: "x",
      name: "Gebruiker Reset",
      role: "BEHEERDER",
    },
  });
});

afterAll(async () => {
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.deleteMany({ where: { organizationId: org.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.$disconnect();
});

describe("generateResetToken / hashResetToken", () => {
  it("genereert elke keer een unieke, voldoende lange token", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hasht deterministisch (zelfde input -> zelfde hash) maar onomkeerbaar", () => {
    const token = generateResetToken();
    expect(hashResetToken(token)).toBe(hashResetToken(token));
    expect(hashResetToken(token)).not.toBe(token);
  });
});

describe("issuePasswordResetToken / consumePasswordResetToken", () => {
  it("een uitgegeven token is precies één keer bruikbaar", async () => {
    const rawToken = await issuePasswordResetToken(user.id);

    const firstUse = await consumePasswordResetToken(rawToken);
    expect(firstUse).toBe(user.id);

    const secondUse = await consumePasswordResetToken(rawToken);
    expect(secondUse).toBeNull();
  });

  it("een nieuw aangevraagd token maakt eerdere, nog niet gebruikte tokens ongeldig", async () => {
    const firstToken = await issuePasswordResetToken(user.id);
    const secondToken = await issuePasswordResetToken(user.id);

    expect(await consumePasswordResetToken(firstToken)).toBeNull();
    expect(await consumePasswordResetToken(secondToken)).toBe(user.id);
  });

  it("een onbekend/verzonnen token wordt afgewezen", async () => {
    expect(await consumePasswordResetToken("dit-token-bestaat-niet")).toBeNull();
  });

  it("een verlopen token wordt afgewezen", async () => {
    const rawToken = await issuePasswordResetToken(user.id);
    await prisma.passwordResetToken.update({
      where: { tokenHash: hashResetToken(rawToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await consumePasswordResetToken(rawToken)).toBeNull();
  });
});
