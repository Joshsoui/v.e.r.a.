// Eenvoudige in-memory rate limiter (fixed window per sleutel).
//
// Bewuste MVP-beperking: dit werkt per proces. Bij horizontale schaling
// (meerdere Render-instances) moet dit vervangen worden door een gedeelde
// store (bv. Redis of een Postgres-tabel). Voor de huidige single-instance
// Render-deployment is dit voldoende en voorkomt het een externe dependency.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Voorkom ongeremde geheugengroei: ruim verlopen buckets periodiek op.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterMs: 0 };
  }

  if (existing.count >= max) {
    return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: max - existing.count,
    retryAfterMs: 0,
  };
}

/** Uitsluitend voor gebruik in tests. */
export function _resetRateLimitStoreForTests() {
  buckets.clear();
}
