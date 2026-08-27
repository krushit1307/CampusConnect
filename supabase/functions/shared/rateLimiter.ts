/**
 * shared/rateLimiter.ts
 *
 * Generic sliding-window rate limiter for Supabase Edge Functions.
 *
 * Usage
 * -----
 *   import { rateLimiter } from "../shared/rateLimiter.ts";
 *
 *   Deno.serve(async (req) => {
 *     const limited = await rateLimiter(req, "my-function", 60, 60);
 *     if (limited) return limited;               // 429 returned early
 *     // ... expensive work here
 *   });
 *
 * Design decisions
 * ----------------
 * • Identifier priority: JWT `sub` (user_id) > hashed IP.
 *   Dormitories share a public IP, so authenticated requests must never be
 *   blocked because an anonymous neighbour hit the limit.
 * • Atomic Lua script: the ZADD → ZREMRANGEBYSCORE → ZCARD → EXPIRE sequence
 *   runs in a single round-trip via `EVAL`, eliminating race conditions that a
 *   multi-command pipeline would introduce.
 * • Pipelining for the IP hash: we use SubtleCrypto (available in Deno Deploy)
 *   to hash the raw IP before storing it in Redis so we never persist PII.
 * • Fail-open: any Redis connection failure is logged and the request is allowed
 *   through so legitimate traffic is never impacted by infrastructure problems.
 * • Latency: a single `EVAL` over Upstash REST adds ~5–15 ms (same region).
 *
 * @module
 */

// @ts-ignore – Deno global
declare const Deno: { env: { get(key: string): string | undefined } };

// @ts-ignore – Deno npm specifier
import { Redis } from "https://esm.sh/@upstash/redis@1.34.3";

// ---------------------------------------------------------------------------
// Singleton Redis client (lazy, fail-safe)
// ---------------------------------------------------------------------------

let _redis: Redis | null | undefined; // undefined = not yet initialised

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;

  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

  if (!url || !token) {
    console.warn(
      "[rateLimiter] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set. " +
        "Rate limiting is disabled (fail-open).",
    );
    _redis = null;
    return null;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

// ---------------------------------------------------------------------------
// Atomic Lua sliding-window script
// ---------------------------------------------------------------------------
//
// KEYS[1]  – Redis sorted-set key  (rate_limit:<function>:<identifier>)
// ARGV[1]  – current timestamp in milliseconds
// ARGV[2]  – limit (max requests per window)
// ARGV[3]  – window size in milliseconds
// ARGV[4]  – unique member id for this request (prevents ZADD collisions)
//
// Returns: [allowed (0|1), remaining, retryAfterSeconds]
//
const LUA_SCRIPT = `
local key       = KEYS[1]
local now       = tonumber(ARGV[1])
local limit     = tonumber(ARGV[2])
local windowMs  = tonumber(ARGV[3])
local memberId  = ARGV[4]

local clearBefore = now - windowMs

-- Atomic sliding-window: add → trim → count → expire
redis.call('ZADD', key, now, memberId)
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
local count = redis.call('ZCARD', key)
redis.call('EXPIRE', key, math.ceil(windowMs / 1000) + 2)

if count <= limit then
  return {1, limit - count, 0}
end

-- Blocked: compute retry-after from the oldest entry
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local retryMs = windowMs
if oldest and #oldest >= 2 then
  retryMs = math.max(0, tonumber(oldest[2]) + windowMs - now)
end
local retryAfterSec = math.max(1, math.ceil(retryMs / 1000))

return {0, 0, retryAfterSec}
`;

// ---------------------------------------------------------------------------
// CORS headers reused in 429 responses
// ---------------------------------------------------------------------------
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Helper: extract identifier
// ---------------------------------------------------------------------------

/**
 * Decode the `sub` claim from a JWT without verifying the signature.
 * Signature verification is done by Supabase Auth; here we only need the
 * user-id so we can use it as a rate-limit bucket key.
 */
function jwtSub(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const parts = authHeader.slice(7).split(".");
  if (parts.length !== 3) return null;
  try {
    const pad = (s: string) => s + "=".repeat((4 - (s.length % 4)) % 4);
    const json = atob(pad(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return (JSON.parse(json) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Hash an IP address with SHA-256 so we never store raw PII in Redis.
 */
async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16); // 64-bit prefix is plenty for bucketing
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply a sliding-window rate limit to an incoming request.
 *
 * @param req           - The incoming `Request` object.
 * @param functionName  - Logical name of the Edge Function (used as Redis key segment).
 * @param limit         - Maximum number of requests allowed inside the window.
 * @param windowSeconds - Length of the sliding window in **seconds**.
 *
 * @returns `null` when the request is within limits (proceed normally).
 *          A `Response` with status 429 when the limit is exceeded (return
 *          this response immediately, before performing any expensive work).
 *
 * @example
 * ```ts
 * const limited = await rateLimiter(req, "send-email", 5, 60);
 * if (limited) return limited;
 * ```
 */
export async function rateLimiter(
  req: Request,
  functionName: string,
  limit: number,
  windowSeconds: number,
): Promise<Response | null> {
  const redis = getRedis();

  // Fail-open: no Redis → skip rate limiting
  if (!redis) return null;

  // Validate parameters
  if (
    !Number.isFinite(limit) ||
    limit <= 0 ||
    !Number.isFinite(windowSeconds) ||
    windowSeconds <= 0
  ) {
    console.warn(
      `[rateLimiter] Invalid config for "${functionName}": limit=${limit}, window=${windowSeconds}s. Skipping.`,
    );
    return null;
  }

  // Determine identifier: authenticated user_id takes priority over IP
  const authHeader = req.headers.get("Authorization");
  const userId = jwtSub(authHeader);

  let identifier: string;
  if (userId) {
    identifier = `user:${userId}`;
  } else {
    const rawIp = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "127.0.0.1";
    identifier = `ip:${await hashIp(rawIp)}`;
  }

  const key = `rl:${functionName}:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const memberId = `${now}:${Math.random().toString(36).slice(2, 9)}`;

  try {
    const result = (await redis.eval(
      LUA_SCRIPT,
      [key],
      [now.toString(), limit.toString(), windowMs.toString(), memberId],
    )) as [number, number, number];

    const [allowed, remaining, retryAfterSec] = result;

    if (allowed === 0) {
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please slow down and try again.",
          retryAfter: retryAfterSec,
        }),
        {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
            "Retry-After": String(retryAfterSec),
          },
        },
      );
    }

    // Request is allowed — we intentionally do NOT add rate-limit headers to
    // success responses so they cannot be used to fingerprint our limits.
    // The 429 headers alone are sufficient for client back-off logic.
    return null;
  } catch (err) {
    // Fail-open: a Redis error must never block legitimate traffic
    console.error(`[rateLimiter] Redis eval failed for "${functionName}" (${identifier}):`, err);
    return null;
  }
}
