import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { verifyCsrf, generateCsrfToken } from "@/lib/auth/csrf";

function makeRequest(opts: { method: string; cookie?: string; header?: string }) {
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.header) headers.set("x-csrf-token", opts.header);
  return new NextRequest("http://localhost:3000/api/reports", {
    method: opts.method,
    headers,
  });
}

describe("verifyCsrf", () => {
  it("staat veilige methodes altijd toe, ook zonder token", () => {
    const req = makeRequest({ method: "GET" });
    expect(verifyCsrf(req)).toBe(true);
  });

  it("weigert een POST zonder cookie en header", () => {
    const req = makeRequest({ method: "POST" });
    expect(verifyCsrf(req)).toBe(false);
  });

  it("weigert een POST met alleen een cookie (geen header)", () => {
    const token = generateCsrfToken();
    const req = makeRequest({ method: "POST", cookie: `vera_csrf=${token}` });
    expect(verifyCsrf(req)).toBe(false);
  });

  it("weigert een POST als cookie en header niet overeenkomen", () => {
    const req = makeRequest({
      method: "POST",
      cookie: `vera_csrf=${generateCsrfToken()}`,
      header: generateCsrfToken(),
    });
    expect(verifyCsrf(req)).toBe(false);
  });

  it("accepteert een POST als cookie en header overeenkomen (double-submit)", () => {
    const token = generateCsrfToken();
    const req = makeRequest({ method: "POST", cookie: `vera_csrf=${token}`, header: token });
    expect(verifyCsrf(req)).toBe(true);
  });

  it("genereert elke keer een unieke, voldoende lange token", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});
