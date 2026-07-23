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
  limit?: number; // Maximum requests allowed in the window (default: 5)
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

-- 1. Remove elements outside the current sliding window
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

-- 2. Get current request count in the window
local requestCount = redis.call('ZCARD', key)

local allowed = 0
local remaining = 0
local retryAfter = 0

if requestCount < limit then
    -- Allowed! Add current request
    redis.call('ZADD', key, now, memberId)
    -- Update expiry of the key to keep Redis clean (windowMs in seconds, rounded up + 2s buffer)
    redis.call('EXPIRE', key, math.ceil(windowMs / 1000) + 2)
    allowed = 1
    remaining = limit - (requestCount + 1)
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

  const limit = Math.floor(config.limit ?? 5);
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

  const key = `rate_limit:${functionName}:${ip}`;
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
