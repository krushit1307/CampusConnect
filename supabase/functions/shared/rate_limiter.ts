import { Redis } from "https://esm.sh/@upstash/redis@1.30.0";

const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export interface RateLimitConfig {
  limit?: number; // Maximum requests allowed in the window (default: 5)
  windowMs?: number; // Window size in milliseconds (default: 60000 / 1 minute)
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

  const limit = config.limit ?? 5;
  const windowMs = config.windowMs ?? 60000;

  // Extract client IP address from the x-forwarded-for header
  const xForwardedFor = req.headers.get("x-forwarded-for");
  const ip = xForwardedFor ? xForwardedFor.split(",")[0].trim() : "127.0.0.1";

  const key = `rate_limit:${functionName}:${ip}`;
  const now = Date.now();
  const clearBefore = now - windowMs;
  const memberId = `${now}:${Math.random().toString(36).substring(2, 9)}`;

  try {
    const pipeline = redis.pipeline();
    // 1. Remove elements outside the current sliding window
    pipeline.zremrangebyscore(key, 0, clearBefore);
    // 2. Add current request's unique member ID with score = now timestamp
    pipeline.zadd(key, { score: now, member: memberId });
    // 3. Get total request count in the window
    pipeline.zcard(key);
    // 4. Update expiry of the key to keep Redis clean
    pipeline.expire(key, Math.ceil(windowMs / 1000));

    const results = await pipeline.exec();
    const requestCount = results[2] as number;

    const remaining = Math.max(0, limit - requestCount);

    const headers = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
    });

    if (requestCount > limit) {
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            ...Object.fromEntries(headers.entries()),
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
