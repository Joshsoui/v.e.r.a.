import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("session JWT", () => {
  it("rondt een geldig token correct terug naar de payload", async () => {
    const payload = { userId: "u1", organizationId: "o1", role: "BEHEERDER" as const };
    const token = await createSessionToken(payload);
    const verified = await verifySessionToken(token);
    expect(verified).toEqual(payload);
  });

  it("wijst een ongeldig/willekeurig token af", async () => {
    const verified = await verifySessionToken("dit-is-geen-geldig-jwt");
    expect(verified).toBeNull();
  });

  it("wijst een geknoeid (gewijzigd) token af", async () => {
    const token = await createSessionToken({
      userId: "u1",
      organizationId: "o1",
      role: "MEDEWERKER",
    });
    const tampered = token.slice(0, -2) + "xx";
    const verified = await verifySessionToken(tampered);
    expect(verified).toBeNull();
  });

  it("wijst een token ondertekend met een ander geheim af", async () => {
    const originalSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "geheim-a-geheim-a-geheim-a-geheim-a";
    const token = await createSessionToken({ userId: "u1", organizationId: "o1", role: "BEHEERDER" });

    process.env.AUTH_SECRET = "een-heel-ander-geheim-xyz-een-heel-ander";
    const verified = await verifySessionToken(token);
    expect(verified).toBeNull();

    process.env.AUTH_SECRET = originalSecret;
  });
});
