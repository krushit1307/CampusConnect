import type { MiddlewareFunction, Request, Response } from "./authMiddleware";

export interface RedisPipeline {
  incr(key: string): RedisPipeline;
  expire(key: string, seconds: number, mode?: "NX" | "XX" | "GT" | "LT"): RedisPipeline;
  exec(): Promise<Array<[Error | null, unknown]>>;
}

export interface RedisClientWithPipeline {
  pipeline(): RedisPipeline;
}

export interface RedisRateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
}

/**
 * High-frequency Redis Rate Limiter utilizing Pipelining (#2430).
 *
 * Executes `incr(key)` and `expire(key, seconds, 'NX')` in a single pipeline
 * atomic round-trip payload to eliminate sequential TCP network round-trips.
 */
export function createRedisRateLimiter(
  redis: RedisClientWithPipeline,
  options: RedisRateLimiterOptions = {},
): MiddlewareFunction {
  const windowMs = options.windowMs || 60000;
  const maxRequests = options.maxRequests || 100;
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next) => {
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(ipHeader) ? ipHeader[0] : ipHeader) || "127.0.0.1";
    const endpoint = req.url || "default";
    const key = `ratelimit:${endpoint}:${ip}`;

    try {
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, windowSeconds, "NX");

      const results = await pipeline.exec();
      if (!results || results.length === 0) {
        next();
        return;
      }

      const [incrErr, incrResult] = results[0];
      if (incrErr) {
        console.error("[RedisRateLimiter] Error in Redis pipeline incr:", incrErr);
        next();
        return;
      }

      const count = Number(incrResult);

      if (count > maxRequests) {
        res.setHeader("Retry-After", String(windowSeconds));
        res.status(429).json({ error: "Too Many Requests: Rate limit exceeded" });
        return;
      }

      next();
    } catch (err) {
      console.error("[RedisRateLimiter] Pipeline execution failed:", err);
      // Fail open to avoid disrupting user traffic if Redis is unavailable
      next();
    }
  };
}
