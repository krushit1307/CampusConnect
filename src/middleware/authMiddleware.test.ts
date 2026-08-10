import { describe, it, expect, vi } from "vitest";
import * as httpMocks from "node-mocks-http";
import { authMiddleware, createRateLimiter, csrfMiddleware } from "./authMiddleware";

describe("authMiddleware - Isolated Unit Tests via node-mocks-http", () => {
  it("rejects request with 401 when Authorization header is missing", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "/api/protected",
    });
    const res = httpMocks.createResponse();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res._isEndCalled()).toBe(true);

    const data = res._getData();
    const payload = typeof data === "string" ? JSON.parse(data) : data;
    expect(payload.error).toMatch(/Missing or malformed Authorization header/);
  });

  it("rejects request with 401 when Authorization header format is malformed", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "/api/protected",
      headers: {
        authorization: "Basic dXNlcjpwYXNz",
      },
    });
    const res = httpMocks.createResponse();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res._isEndCalled()).toBe(true);
  });

  it("rejects request with 401 when Bearer token is invalid", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "/api/protected",
      headers: {
        authorization: "Bearer INVALID_TOKEN",
      },
    });
    const res = httpMocks.createResponse();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res._isEndCalled()).toBe(true);

    const data = res._getData();
    const payload = typeof data === "string" ? JSON.parse(data) : data;
    expect(payload.error).toMatch(/Invalid authentication token/);
  });

  it("authenticates valid Bearer token and calls next()", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "/api/protected",
      headers: {
        authorization: "Bearer VALID_CAMPUS_TOKEN_123",
      },
    });
    const res = httpMocks.createResponse();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res._isEndCalled()).toBe(false);
    expect(req.user).toEqual({
      id: "user-123",
      email: "student@campusconnect.edu",
      role: "student",
    });
  });
});

describe("createRateLimiter - Isolated Unit Tests via node-mocks-http", () => {
  it("allows requests under the configured threshold", () => {
    const rateLimiter = createRateLimiter({ maxRequests: 2, windowMs: 60000 });
    const req = httpMocks.createRequest({
      method: "POST",
      url: "/api/actions",
      headers: { "x-forwarded-for": "192.168.1.1" },
    });
    const res = httpMocks.createResponse();
    const next = vi.fn();

    rateLimiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._isEndCalled()).toBe(false);
  });

  it("rejects request with 429 when rate limit is exceeded", () => {
    const rateLimiter = createRateLimiter({ maxRequests: 1, windowMs: 60000 });
    const req1 = httpMocks.createRequest({
      method: "POST",
      url: "/api/actions",
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    const res1 = httpMocks.createResponse();
    const next1 = vi.fn();

    rateLimiter(req1, res1, next1);
    expect(next1).toHaveBeenCalledTimes(1);

    const req2 = httpMocks.createRequest({
      method: "POST",
      url: "/api/actions",
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    const res2 = httpMocks.createResponse();
    const next2 = vi.fn();

    rateLimiter(req2, res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(429);
    expect(res2._isEndCalled()).toBe(true);

    const data = res2._getData();
    const payload = typeof data === "string" ? JSON.parse(data) : data;
    expect(payload.error).toMatch(/Rate limit exceeded/);
  });
});

describe("csrfMiddleware - Isolated Unit Tests via node-mocks-http", () => {
  it("bypasses CSRF check for safe GET requests", () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "/api/data",
    });
    const res = httpMocks.createResponse();
    const next = vi.fn();

    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._isEndCalled()).toBe(false);
  });

  it("rejects POST request with 403 when CSRF header is missing", () => {
    const req = httpMocks.createRequest({
      method: "POST",
      url: "/api/update",
    });
    const res = httpMocks.createResponse();
    const next = vi.fn();

    csrfMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res._isEndCalled()).toBe(true);
  });

  it("allows POST request with valid CSRF header", () => {
    const req = httpMocks.createRequest({
      method: "POST",
      url: "/api/update",
      headers: {
        "x-csrf-token": "VALID_CSRF_TOKEN_456",
      },
    });
    const res = httpMocks.createResponse();
    const next = vi.fn();

    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._isEndCalled()).toBe(false);
  });
});
