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

/** Default time-to-live for a cached feed page, in seconds. */
export const FEED_CACHE_TTL_SECONDS = 30;

/**
 * Builds the Redis key for a given feed page.
 *
 * Intentionally keyed by CURSOR, not by user id — the global feed
 * (`get_posts_relay`) returns the same rows for every visitor, so a
 * single cached copy can be shared by everyone requesting that page,
 * instead of one duplicate copy per user.
 */
export function getFeedCacheKey(afterCursor: string | null | undefined): string {
  return `feed:page:${afterCursor ?? "first"}`;
}

/** Returns the cached page payload, or null on a cache miss / if Redis isn't configured. */
export async function getCachedPage<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const cached = await redis.get<T>(key);
    return cached ?? null;
  } catch (err) {
    console.warn(`[feedCache] get failed for ${key}:`, err);
    return null;
  }
}

/** Stores a page payload in Redis with a short TTL. No-ops if Redis isn't configured. */
export async function setCachedPage<T>(
  key: string,
  payload: T,
  ttlSeconds: number = FEED_CACHE_TTL_SECONDS,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, payload, { ex: ttlSeconds });
  } catch (err) {
    console.warn(`[feedCache] set failed for ${key}:`, err);
  }
}

/** Deletes every cached feed page. Used on post deletion/moderation. */
export async function purgeAllFeedPages(): Promise<number> {
  if (!redis) return 0;
  try {
    const keys = await redis.keys("feed:page:*");
    if (keys.length === 0) return 0;
    await redis.del(...keys);
    return keys.length;
  } catch (err) {
    console.warn("[feedCache] purge failed:", err);
    return 0;
  }
}
