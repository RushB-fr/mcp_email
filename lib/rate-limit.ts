import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

/**
 * In-memory sliding-window rate limiter. Sufficient for a single-container
 * self-hosted instance; resets on process restart, which is an acceptable
 * trade-off here (not a distributed multi-instance deployment).
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/**
 * This app is only ever reachable through the Traefik reverse proxy (the
 * prod compose file publishes no ports of its own) - X-Forwarded-For is
 * trustworthy here in the sense that Traefik appends the real peer IP it
 * observed as the LAST entry, regardless of whatever value a client sent in
 * up front. Taking the FIRST entry (the naive/common mistake) would instead
 * read back the client-supplied, unverified claim - trivially spoofable to
 * get a fresh rate-limit bucket on every request. Always take the last
 * entry, never the first.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return headers.get("x-real-ip") ?? "unknown";
}
