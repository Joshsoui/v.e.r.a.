import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hasht een wachtwoord en verifieert het correct terug", async () => {
    const hash = await hashPassword("EenSterkWachtwoord123");
    expect(hash).not.toBe("EenSterkWachtwoord123");
    expect(await verifyPassword("EenSterkWachtwoord123", hash)).toBe(true);
  });

  it("wijst een verkeerd wachtwoord af", async () => {
    const hash = await hashPassword("EenSterkWachtwoord123");
    expect(await verifyPassword("VerkeerdWachtwoord", hash)).toBe(false);
  });

  it("genereert verschillende hashes voor hetzelfde wachtwoord (salt)", async () => {
    const a = await hashPassword("hetzelfde-wachtwoord");
    const b = await hashPassword("hetzelfde-wachtwoord");
    expect(a).not.toBe(b);
  });
});

describe("isPasswordStrongEnough", () => {
  it("wijst korte wachtwoorden af", () => {
    expect(isPasswordStrongEnough("kort123")).toBe(false);
  });

  it("accepteert wachtwoorden van 10+ tekens", () => {
    expect(isPasswordStrongEnough("minimaal10tekens")).toBe(true);
  });
});
