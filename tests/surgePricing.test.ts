import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocking Edge Function Environment for Testing Logic
const mockRedisZadd = vi.fn();
const mockRedisZremrangebyscore = vi.fn();
const mockRedisZcard = vi.fn();
const mockRedisExpire = vi.fn();

class MockRedis {
  zadd = mockRedisZadd;
  zremrangebyscore = mockRedisZremrangebyscore;
  zcard = mockRedisZcard;
  expire = mockRedisExpire;
}

vi.stubGlobal("Deno", {
  env: {
    get: vi.fn((key) => {
      if (key === "UPSTASH_REDIS_REST_URL") return "http://mock";
      if (key === "UPSTASH_REDIS_REST_TOKEN") return "token";
      return "mock";
    }),
  },
});

// Extracted Surge Check Logic for unit testing
async function evaluateSurgeConfig(eventId: string, surgeConfig: any, redisClient: MockRedis) {
  let isSurgeActive = false;
  let salesVelocity = 0;
  let finalPriceMultiplier = 1.0;

  if (surgeConfig && surgeConfig.enabled) {
    try {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const key = `sales_velocity:${eventId}`;

      await redisClient.zremrangebyscore(key, 0, oneMinuteAgo);
      salesVelocity = await redisClient.zcard(key);

      if (salesVelocity >= surgeConfig.threshold) {
        isSurgeActive = true;
        finalPriceMultiplier = surgeConfig.multiplier;
      }
    } catch (err) {
      // Fallback
      isSurgeActive = false;
    }
  }

  return { isSurgeActive, salesVelocity, finalPriceMultiplier };
}

describe("Server-Side Surge Logic Verification", () => {
  let redis: MockRedis;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = new MockRedis();
  });

  it("should not activate surge if config is disabled", async () => {
    const config = { enabled: false, threshold: 10, multiplier: 1.5 };
    const result = await evaluateSurgeConfig("event-1", config, redis);

    expect(result.isSurgeActive).toBe(false);
    expect(result.finalPriceMultiplier).toBe(1.0);
    expect(mockRedisZcard).not.toHaveBeenCalled();
  });

  it("should activate surge (1.5x) if sales velocity > threshold", async () => {
    mockRedisZcard.mockResolvedValue(15);
    const config = { enabled: true, threshold: 10, multiplier: 1.5 };

    const result = await evaluateSurgeConfig("event-1", config, redis);

    expect(mockRedisZremrangebyscore).toHaveBeenCalledWith(
      "sales_velocity:event-1",
      0,
      expect.any(Number),
    );
    expect(result.isSurgeActive).toBe(true);
    expect(result.salesVelocity).toBe(15);
    expect(result.finalPriceMultiplier).toBe(1.5);
  });

  it("should activate surge (1.2x) if sales velocity > threshold", async () => {
    mockRedisZcard.mockResolvedValue(11);
    const config = { enabled: true, threshold: 10, multiplier: 1.2 };

    const result = await evaluateSurgeConfig("event-1", config, redis);

    expect(result.isSurgeActive).toBe(true);
    expect(result.finalPriceMultiplier).toBe(1.2);
  });

  it("should activate surge if sales velocity == threshold", async () => {
    mockRedisZcard.mockResolvedValue(10);
    const config = { enabled: true, threshold: 10, multiplier: 1.5 };

    const result = await evaluateSurgeConfig("event-1", config, redis);

    expect(result.isSurgeActive).toBe(true);
    expect(result.finalPriceMultiplier).toBe(1.5);
  });

  it("should revert to baseline pricing if sales velocity drops below threshold", async () => {
    mockRedisZcard.mockResolvedValue(9);
    const config = { enabled: true, threshold: 10, multiplier: 1.5 };

    const result = await evaluateSurgeConfig("event-1", config, redis);

    expect(result.isSurgeActive).toBe(false);
    expect(result.finalPriceMultiplier).toBe(1.0);
  });

  it("should fallback to normal pricing if Redis fails", async () => {
    mockRedisZcard.mockRejectedValue(new Error("Redis Timeout"));
    const config = { enabled: true, threshold: 10, multiplier: 1.5 };

    const result = await evaluateSurgeConfig("event-1", config, redis);

    expect(result.isSurgeActive).toBe(false);
    expect(result.finalPriceMultiplier).toBe(1.0);
  });

  it("should correctly calculate zremrangebyscore timestamps for stale entries", async () => {
    const fakeNow = 1700000060000;
    vi.spyOn(Date, "now").mockReturnValue(fakeNow);

    const config = { enabled: true, threshold: 10, multiplier: 1.5 };
    await evaluateSurgeConfig("event-1", config, redis);

    expect(mockRedisZremrangebyscore).toHaveBeenCalledWith(
      "sales_velocity:event-1",
      0,
      1700000000000, // 60 seconds prior
    );
  });
});

// Extracted Webhook Tracking Logic for unit testing
async function simulateStripeWebhook(eventId: string, memberId: string, redisClient: MockRedis) {
  const now = Date.now();
  const key = `sales_velocity:${eventId}`;

  await redisClient.zadd(key, { score: now, member: memberId });
  await redisClient.expire(key, 120);
}

describe("Stripe Webhook Sales Tracking", () => {
  let redis: MockRedis;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = new MockRedis();
  });

  it("should add successful purchases to Redis sorted set with expiry", async () => {
    const fakeNow = 1700000060000;
    vi.spyOn(Date, "now").mockReturnValue(fakeNow);

    await simulateStripeWebhook("evt-123", "sess_xyz", redis);

    expect(mockRedisZadd).toHaveBeenCalledWith("sales_velocity:evt-123", {
      score: fakeNow,
      member: "sess_xyz",
    });
    expect(mockRedisExpire).toHaveBeenCalledWith("sales_velocity:evt-123", 120);
  });
});
