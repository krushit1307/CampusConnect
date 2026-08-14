// @ts-ignore
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore
import { Redis } from "https://esm.sh/@upstash/redis@1.30.0";

const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export interface RateLimitConfig {
  limit?: number; // Maximum requests allowed in the window (default: 60)
  windowMs?: number; // Window size in milliseconds (default: 60000 / 1 minute)
}

// Embedded Lua script for atomic sliding window rate limiting
const LUA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
local memberId = ARGV[4]

local clearBefore = now - windowMs

-- 1. Drop a timestamp into the ZSET
redis.call('ZADD', key, now, memberId)

-- 2. Remove all timestamps older than the sliding window
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

-- 3. Count the remaining elements
local requestCount = redis.call('ZCARD', key)

-- 4. Update expiry of the key to keep Redis clean (windowMs in seconds, rounded up + 2s buffer)
redis.call('EXPIRE', key, math.ceil(windowMs / 1000) + 2)

local allowed = 0
local remaining = 0
local retryAfter = 0

if requestCount <= limit then
    allowed = 1
    remaining = limit - requestCount
else
    -- Blocked! Get oldest element to calculate retry-after
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    if oldest and #oldest >= 2 then
        local oldestTime = tonumber(oldest[2])
        local waitMs = (oldestTime + windowMs) - now
        retryAfter = math.ceil(waitMs / 1000)
    else
        retryAfter = math.ceil(windowMs / 1000)
    end
    if retryAfter < 1 then
        retryAfter = 1
    end
    allowed = 0
    remaining = 0
end

return {allowed, remaining, retryAfter}
`;

/**
 * Decodes the JWT sub (User ID) from the Authorization header if present.
 * Uses fast, synchronous base64url decoding to prevent network call overhead.
 */
export function getUserIdFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = atob(base64);
    const data = JSON.parse(jsonStr);
    return data.sub || null;
  } catch {
    return null;
  }
}

/**
 * Checks the rate limit for the incoming request based on the client's IP.
 * Returns a 429 Response if the limit is exceeded, or null if the request is allowed.
 *
 * @param req The incoming Request object
 * @param functionName The name of the Edge Function (to segment Redis keys)
 * @param config Optional rate limit configuration (limit, windowMs)
 */
export async function limitRate(
  req: Request,
  functionName: string,
  config: RateLimitConfig = {},
): Promise<Response | null> {
  if (!redis) {
    console.warn(
      `[RateLimiter] Upstash Redis is not configured. Skipping rate limiting for: ${functionName}`,
    );
    return null;
  }

  const limit = Math.floor(config.limit ?? 60);
  const windowMs = Math.floor(config.windowMs ?? 60000);

  if (limit <= 0 || windowMs <= 0 || !Number.isFinite(limit) || !Number.isFinite(windowMs)) {
    console.warn(
      `[RateLimiter] Invalid rate limit configuration: limit=${limit}, windowMs=${windowMs}. Skipping rate limiting for: ${functionName}`,
    );
    return null;
  }

  // Extract client IP address from the x-forwarded-for header
  const xForwardedFor = req.headers.get("x-forwarded-for");
  const ip = xForwardedFor ? xForwardedFor.split(",")[0].trim() : "127.0.0.1";

  // Use JWT User ID if available, otherwise fall back to IP address
  const authHeader = req.headers.get("Authorization");
  const userId = getUserIdFromAuthHeader(authHeader);
  const identifier = userId || ip;

  const key = `rate_limit:${functionName}:${identifier}`;
  const now = Date.now();
  const memberId = `${now}:${Math.random().toString(36).substring(2, 9)}`;

  try {
    // Execute the Lua script atomically on the Upstash Redis instance
    const result = await redis.eval(
      LUA_SCRIPT,
      [key],
      [now.toString(), limit.toString(), windowMs.toString(), memberId],
    );

    // Upstash Redis eval returns the array response from Lua
    const [allowed, remaining, retryAfter] = result as [number, number, number];

    const responseHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
    };

    if (allowed === 0) {
      responseHeaders["Retry-After"] = retryAfter.toString();
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            ...responseHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return null;
  } catch (err) {
    console.error(
      `[RateLimiter] Error performing rate limit check for ${functionName} (IP: ${ip}):`,
      err,
    );
    // Fail open: log the error, but allow the request to proceed to not disrupt legitimate traffic
    return null;
  }
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function validateSignature(req: Request): Promise<Response | null> {
  const signature = req.headers.get("X-Request-Signature");
  const timestamp = req.headers.get("X-Request-Timestamp");
  const nonce = req.headers.get("X-Request-Nonce");

  if (!signature || !timestamp || !nonce) {
    return new Response(
      JSON.stringify({ error: "Missing request signature headers" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  // 1. Replay attack time-window check (5 minutes)
  const requestTime = Number(timestamp);
  if (isNaN(requestTime) || Math.abs(Date.now() - requestTime) > 300000) {
    return new Response(
      JSON.stringify({ error: "Request signature expired" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  // 2. Replay attack duplicate nonce check in Redis
  if (redis) {
    try {
      const nonceKey = `nonce:${nonce}`;
      const exists = await redis.get(nonceKey);
      if (exists) {
        return new Response(
          JSON.stringify({ error: "Replay attack detected" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          }
        );
      }
      await redis.set(nonceKey, "1", { ex: 300 });
    } catch (err) {
      console.error("[SignatureValidator] Redis nonce check error:", err);
    }
  }

  // 3. Recalculate HMAC-SHA256 signature
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();
  const bodyText = req.body ? await req.clone().text() : "";

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : "";
  const key = token;

  const message = `${method}:${path}:${timestamp}:${nonce}:${bodyText}`;
  const calculatedSignature = await hmacSha256(key, message);

  if (signature !== calculatedSignature) {
    return new Response(
      JSON.stringify({ error: "Invalid request signature" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  return null;
}

