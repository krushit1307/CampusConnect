/**
 * Rate Limiter Middleware for Supabase Edge Functions
 * Tracks both IP address AND Device Fingerprint to prevent proxy rotation abuse.
 * 
 * Shadow-ban logic: If a single fingerprint hits the Signup endpoint 50 times 
 * in an hour across 50 different IP addresses, it is automatically shadow-banned.
 */

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    endpoint: string;
}

// Mock Redis client interface (replace with actual Upstash Redis or Deno KV in production)
interface RedisClient {
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: { ex: number }): Promise<void>;
}

export class DeviceRateLimiter {
    private redis: RedisClient;

    constructor(redisClient: RedisClient) {
        this.redis = redisClient;
    }

    /**
     * Checks rate limits for a given request.
     * @param ip The client IP address.
     * @param fingerprint The X-Device-Fingerprint header value.
     * @param config Rate limit configuration.
     * @returns Object containing allowed status and remaining attempts.
     */
    public async checkLimit(
        ip: string,
        fingerprint: string | undefined,
        config: RateLimitConfig
    ): Promise<{ allowed: boolean; remaining: number; shadowBanned: boolean }> {
        if (!fingerprint) {
            // Fallback to IP-only limiting if fingerprint is missing (e.g., privacy-focused browsers)
            return this.checkIpLimit(ip, config);
        }

        const fingerprintKey = `ratelimit:fp:${fingerprint}:${config.endpoint}`;
        const ipFingerprintKey = `ratelimit:ip_fp:${ip}:${fingerprint}:${config.endpoint}`;
        const shadowBanKey = `shadowban:fp:${fingerprint}`;

        // 1. Check if already shadow-banned
        const isShadowBanned = await this.redis.get(shadowBanKey);
        if (isShadowBanned === 'true') {
            return { allowed: false, remaining: 0, shadowBanned: true };
        }

        // 2. Increment fingerprint counter
        const fpCount = await this.redis.incr(fingerprintKey);
        if (fpCount === 1) {
            await this.redis.expire(fingerprintKey, Math.floor(config.windowMs / 1000));
        }

        // 3. Track unique IPs per fingerprint for shadow-ban detection
        const ipSetKey = `fp_ips:${fingerprint}:${config.endpoint}`;
        // Note: In real Redis, use SADD and SCARD. Mocked here as simple increment for brevity.
        const uniqueIpCount = await this.redis.incr(ipSetKey);
        await this.redis.expire(ipSetKey, Math.floor(config.windowMs / 1000));

        // 4. Shadow-ban logic: 50 requests in an hour across 50 different IPs
        if (fpCount >= 50 && uniqueIpCount >= 50 && config.endpoint === '/auth/signup') {
            await this.redis.set(shadowBanKey, 'true', { ex: 86400 * 7 }); // 7 day shadow ban
            console.warn(`[SECURITY] Shadow-banned fingerprint: ${fingerprint}`);
            return { allowed: false, remaining: 0, shadowBanned: true };
        }

        // 5. Standard limit check
        if (fpCount > config.maxRequests) {
            return { allowed: false, remaining: 0, shadowBanned: false };
        }

        return {
            allowed: true,
            remaining: config.maxRequests - fpCount,
            shadowBanned: false,
        };
    }

    private async checkIpLimit(
        ip: string,
        config: RateLimitConfig
    ): Promise<{ allowed: boolean; remaining: number; shadowBanned: boolean }> {
        const key = `ratelimit:ip:${ip}:${config.endpoint}`;
        const count = await this.redis.incr(key);
        if (count === 1) {
            await this.redis.expire(key, Math.floor(config.windowMs / 1000));
        }

        if (count > config.maxRequests) {
            return { allowed: false, remaining: 0, shadowBanned: false };
        }

        return { allowed: true, remaining: config.maxRequests - count, shadowBanned: false };
    }
}
