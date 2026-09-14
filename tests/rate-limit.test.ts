import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, _resetRateLimitStoreForTests } from "@/lib/security/rateLimit";

beforeEach(() => {
  _resetRateLimitStoreForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("staat requests toe tot aan de max, en blokkeert daarna", () => {
    const key = "test-key-1";
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    const fourth = checkRateLimit(key, 3, 60_000);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it("houdt verschillende sleutels apart bij", () => {
    checkRateLimit("user-a", 1, 60_000);
    const resultB = checkRateLimit("user-b", 1, 60_000);
    expect(resultB.allowed).toBe(true);
  });

  it("reset na afloop van het tijdvenster", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const key = "test-key-2";
    expect(checkRateLimit(key, 1, 1000).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 1000).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:00:01.001Z"));
    expect(checkRateLimit(key, 1, 1000).allowed).toBe(true);
  });
});
