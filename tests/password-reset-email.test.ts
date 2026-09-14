import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sendPasswordResetEmail } from "@/lib/email/passwordResetEmail";

// RESEND_API_KEY is bewust niet gezet in .env.test (er is geen echte Resend-
// account voor de testsuite) — dit test dus expliciet het "niet
// geconfigureerd"-pad, dat forgot-password/route.ts laat terugvallen op het
// loggen van de resetlink. Het "sent"/"failed"-pad vereist een echte (of
// gemockte) Resend-aanroep en is buiten scope van deze unit-test.

describe("sendPasswordResetEmail", () => {
  const original = process.env.RESEND_API_KEY;

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    if (original !== undefined) process.env.RESEND_API_KEY = original;
  });

  it("geeft 'not_configured' terug als er geen RESEND_API_KEY is ingesteld", async () => {
    const result = await sendPasswordResetEmail("test@example.test", "http://localhost:3000/reset-password?token=x");
    expect(result).toBe("not_configured");
  });
});
