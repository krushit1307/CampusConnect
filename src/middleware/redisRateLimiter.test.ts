import { describe, it, expect, vi } from "vitest";
import { createRedisRateLimiter, RedisClientWithPipeline } from "./redisRateLimiter";
import type { Request, Response } from "./authMiddleware";

describe("Redis Rate Limiter with Pipelining (#2430)", () => {
  it("executes incr and expire in a single pipeline call", async () => {
    const mockExec = vi.fn().mockResolvedValue([
      [null, 1], // incr result
      [null, "OK"], // expire result
    ]);
    const mockPipeline = {
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: mockExec,
    };
    const mockRedis: RedisClientWithPipeline = {
      pipeline: vi.fn().mockReturnValue(mockPipeline),
    };

    const limiter = createRedisRateLimiter(mockRedis, { maxRequests: 5, windowMs: 60000 });

    const req: Request = {
      headers: { "x-forwarded-for": "192.168.1.1" },
      url: "/api/posts",
    };
    const res: Partial<Response> = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await limiter(req, res as Response, next);

    expect(mockRedis.pipeline).toHaveBeenCalledTimes(1);
    expect(mockPipeline.incr).toHaveBeenCalledWith("ratelimit:/api/posts:192.168.1.1");
    expect(mockPipeline.expire).toHaveBeenCalledWith("ratelimit:/api/posts:192.168.1.1", 60, "NX");
    expect(mockExec).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("blocks requests with 429 when pipeline count exceeds maxRequests", async () => {
    const mockExec = vi.fn().mockResolvedValue([
      [null, 6], // count 6 > maxRequests 5
      [null, "OK"],
    ]);
    const mockPipeline = {
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: mockExec,
    };
    const mockRedis: RedisClientWithPipeline = {
      pipeline: vi.fn().mockReturnValue(mockPipeline),
    };

    const limiter = createRedisRateLimiter(mockRedis, { maxRequests: 5, windowMs: 60000 });

    const req: Request = {
      headers: { "x-forwarded-for": "10.0.0.1" },
      url: "/api/checkout",
    };
    const setHeaderMock = vi.fn().mockReturnThis();
    const statusMock = vi.fn().mockReturnThis();
    const jsonMock = vi.fn().mockReturnThis();
    const res: Partial<Response> = {
      setHeader: setHeaderMock,
      status: statusMock,
      json: jsonMock,
    };
    const next = vi.fn();

    await limiter(req, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(429);
    expect(jsonMock).toHaveBeenCalledWith({ error: "Too Many Requests: Rate limit exceeded" });
    expect(next).not.toHaveBeenCalled();
  });
});
