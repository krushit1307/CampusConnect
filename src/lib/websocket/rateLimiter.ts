/**
 * Token Bucket Rate Limiter for WebSocket Chat
 * Uses Redis to maintain state across distributed Next.js instances.
 */

import { getRedisClient } from '@/lib/redis/client';

export interface RateLimitResult {
    allowed: boolean;
    remainingTokens: number;
    retryAfterSeconds: number;
}

/**
 * Applies token bucket rate limiting to a specific user in a chat channel.
 * Capacity: 5 tokens. Refill rate: 1 token per 3 seconds.
 */
export async function checkChatRateLimit(userId: string): Promise<RateLimitResult> {
    const client = getRedisClient();
    const key = `chat_ratelimit:${userId}`;
    const now = Math.floor(Date.now() / 1000);

    const capacity = 5;
    const refillRate = 1 / 3; // 1 token per 3 seconds

    // Lua script for atomic token bucket operation
    const luaScript = `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local requested = tonumber(ARGV[4])

    local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(bucket[1])
    local last_refill = tonumber(bucket[2])

    if not tokens then
        tokens = capacity
        last_refill = now
    else
        local elapsed = now - last_refill
        local refill_tokens = elapsed * refill_rate
        tokens = math.min(capacity, tokens + refill_tokens)
        last_refill = now
    end

    if tokens >= requested then
        tokens = tokens - requested
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
        redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 10)
        return {1, tokens}
    else
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
        return {0, tokens}
    end
  `;

    try {
        const result = await client.eval(luaScript, {
            keys: [key],
            arguments: [capacity.toString(), refillRate.toString(), now.toString(), '1'],
        });

        const [allowed, remaining] = result as [number, number];

        // Calculate retry after: time needed to get 1 token
        const tokensNeeded = 1 - remaining;
        const retryAfterSeconds = tokensNeeded > 0 ? Math.ceil(tokensNeeded / refillRate) : 0;

        return {
            allowed: allowed === 1,
            remainingTokens: Math.max(0, Math.floor(remaining)),
            retryAfterSeconds,
        };
    } catch (error) {
        console.error('Chat rate limit check failed:', error);
        // Fail closed for security
        return { allowed: false, remainingTokens: 0, retryAfterSeconds: 5 };
    }
}
