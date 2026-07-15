import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ============================================================================
// S-06: client IP resolution.
//
// Raw `x-forwarded-for` is client-settable unless a trusted reverse proxy
// overwrites it before the request reaches this process — trusting it
// blindly lets an attacker send a fresh value on every request to get a
// brand-new rate-limit bucket each time, fully defeating rateLimit() below.
//
// `x-vercel-forwarded-for` (and `x-vercel-proxied-for`) are set by Vercel's
// edge network itself and are documented as unspoofable on that platform —
// prefer them when present. Plain `x-forwarded-for` is used only as a
// fallback (e.g. local dev via `next dev`, or a self-hosted deployment that
// has been placed behind a properly configured reverse proxy that strips/
// overwrites client-supplied values). Deployers running this anywhere other
// than Vercel are responsible for ensuring their proxy does that; this
// function has no way to verify it from inside the Node process.
// ============================================================================

const IPV4_OR_IPV6 = /^[0-9a-fA-F.:]+$/;

export function getClientIp(request: Request): string {
  const trusted = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-vercel-proxied-for");
  const raw = trusted ?? request.headers.get("x-forwarded-for");
  const candidate = raw?.split(",")[0]?.trim();
  return candidate && IPV4_OR_IPV6.test(candidate) ? candidate : "unknown";
}

// ============================================================================
// S-07: distributed rate limiting.
//
// The previous in-memory Map only limits requests within a single process —
// on any horizontally-scaled deployment (multiple serverless instances),
// each instance has its own independent counters, so the effective limit is
// `limit * instanceCount`, not `limit`.
//
// When UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are configured, every
// call is backed by a shared Redis sliding-window counter instead, so the
// limit holds regardless of how many instances are running. Without those
// env vars (local dev, or a deployment that hasn't provisioned Redis yet)
// this transparently falls back to the original single-instance in-memory
// limiter — correct for local/single-instance use, just not distributed.
// ============================================================================

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// Upstash's Ratelimit needs one instance per distinct (limit, window) pair —
// cached by key so repeated calls with the same shape reuse it instead of
// constructing a new one (and a new local queue) on every request.
const distributedLimiters = new Map<string, Ratelimit>();

function getDistributedLimiter(limit: number, windowMs: number): Ratelimit {
  const key = `${limit}:${windowMs}`;
  let limiter = distributedLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      analytics: false,
    });
    distributedLimiters.set(key, limiter);
  }
  return limiter;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

function inMemoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

// Kept synchronous (in-memory path) / fire-and-check (Redis path handled by
// rateLimitAsync below) for callers that can't await — Route Handlers should
// prefer rateLimitAsync when Redis is configured so the distributed check is
// actually awaited rather than racing ahead optimistically.
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  return inMemoryRateLimit(key, limit, windowMs);
}

export async function rateLimitAsync(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!redis) return inMemoryRateLimit(key, limit, windowMs);
  const { success } = await getDistributedLimiter(limit, windowMs).limit(key);
  return success;
}
