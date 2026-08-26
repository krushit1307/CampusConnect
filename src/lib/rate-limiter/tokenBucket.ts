/**
 * Token Bucket Rate Limiter Implementation
 * Uses Redis to maintain state across distributed Next.js instances.
 */

import { getRedisClient } from '@/lib/redis/client';

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number; // Unix timestamp in seconds
    limit: number;
}

/**
 * Applies token bucket rate limiting to a specific key (IP or API Key).
 * 
 * @param key - Unique identifier for the requester
 * @param maxTokens - Maximum number of requests allowed in the window
 * @param windowSeconds - Time window in seconds (e.g., 900 for 15 minutes)
 * @returns Promise<RateLimitResult>
 */
export async function checkRateLimit(
    key: string,
    maxTokens: number = 100,
    windowSeconds: number = 900
): Promise<RateLimitResult> {
    const client = getRedisClient();
    const now = Math.floor(Date.now() / 1000);
    const resetTime = now + windowSeconds;

    // Use a Lua script for atomic operations to prevent race conditions
    const luaScript = `
    local key = KEYS[1]
    local max_tokens = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    
    local bucket = redis.call('HMGET', key, 'tokens', 'reset_time')
    local tokens = tonumber(bucket[1])
    local reset_time = tonumber(bucket[2])
    
    if not tokens or not reset_time or now > reset_time then
      -- Initialize or reset bucket
      tokens = max_tokens - 1
      reset_time = now + window
      redis.call('HMSET', key, 'tokens', tokens, 'reset_time', reset_time)
      redis.call('EXPIRE', key, window)
      return {1, tokens, reset_time}
    end
    
    if tokens > 0 then
      -- Consume a token
      tokens = tokens - 1
      redis.call('HINCRBY', key, 'tokens', -1)
      return {1, tokens, reset_time}
    end
    
    -- Bucket empty
    return {0, 0, reset_time}
  `;

    try {
        const result = await client.eval(luaScript, {
            keys: [`ratelimit:${key}`],
            arguments: [maxTokens.toString(), windowSeconds.toString(), now.toString()],
        });

        const [allowed, remaining, reset] = result as [number, number, number];

        return {
            allowed: allowed === 1,
            remaining: Math.max(0, remaining),
            resetTime: reset,
            limit: maxTokens,
        };
    } catch (error) {
        console.error('Rate limit check failed:', error);
        // Fail open or closed? For security, fail closed (not allowed)
        return {
            allowed: false,
            remaining: 0,
            resetTime: now + 60,
            limit: maxTokens,
        };
    }
}
