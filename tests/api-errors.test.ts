import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ApiError,
  handleApiError,
  notFoundResponse,
  unauthorizedResponse,
  rateLimitedResponse,
} from "@/lib/utils/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleApiError", () => {
  it("geeft de publieke boodschap en status terug voor een ApiError", async () => {
    const res = handleApiError(new ApiError(409, "Dit e-mailadres is al in gebruik."));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ error: "Dit e-mailadres is al in gebruik." });
  });

  it("lekt NOOIT interne foutdetails voor een onverwachte fout", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const internalError = new Error("Databasewachtwoord verkeerd: connection string xyz123");
    const res = handleApiError(internalError);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Er is een onverwachte fout opgetreden.");
    expect(JSON.stringify(body)).not.toContain("xyz123");
    // De interne fout wordt wel server-side gelogd, zodat hij niet verloren gaat.
    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe("generieke responses", () => {
  it("notFoundResponse geeft altijd status 404 met een generieke boodschap (IDOR-bescherming)", async () => {
    const res = notFoundResponse();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Niet gevonden.");
  });

  it("unauthorizedResponse geeft status 401", () => {
    expect(unauthorizedResponse().status).toBe(401);
  });

  it("rateLimitedResponse geeft status 429 met een Retry-After header", () => {
    const res = rateLimitedResponse(5000);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
  });
});
