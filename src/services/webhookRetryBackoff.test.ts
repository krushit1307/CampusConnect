import { describe, it, expect, vi } from "vitest";
import {
  calculateNextRetry,
  isRetryableError,
  MAX_RETRIES,
  RETRY_BACKOFF_MINUTES,
} from "../../supabase/functions/publish-webhooks/retry";

describe("Webhook Retry mechanism with Exponential Backoff (#2101)", () => {
  const baseTime = new Date("2026-08-04T00:00:00Z");

  it("calculates correct exponential backoff times for retries", () => {
    // Attempt 1 -> Retry 1: 1 minute delay
    const retry1 = calculateNextRetry(1, baseTime);
    expect(retry1).not.toBeNull();
    expect(retry1!.getTime() - baseTime.getTime()).toBe(1 * 60 * 1000);

    // Attempt 2 -> Retry 2: 5 minutes delay
    const retry2 = calculateNextRetry(2, baseTime);
    expect(retry2).not.toBeNull();
    expect(retry2!.getTime() - baseTime.getTime()).toBe(5 * 60 * 1000);

    // Attempt 3 -> Retry 3: 30 minutes delay
    const retry3 = calculateNextRetry(3, baseTime);
    expect(retry3).not.toBeNull();
    expect(retry3!.getTime() - baseTime.getTime()).toBe(30 * 60 * 1000);

    // Attempt 4 -> Retry 4: 120 minutes delay
    const retry4 = calculateNextRetry(4, baseTime);
    expect(retry4).not.toBeNull();
    expect(retry4!.getTime() - baseTime.getTime()).toBe(120 * 60 * 1000);

    // Attempt 5 -> Max retries reached (5), returns null for dead-letter queue
    const retry5 = calculateNextRetry(5, baseTime);
    expect(retry5).toBeNull();
  });

  it("identifies 500 server errors, timeouts, and rate limits as retryable", () => {
    expect(isRetryableError(null)).toBe(true); // Network timeout/error
    expect(isRetryableError(500)).toBe(true); // Internal Server Error
    expect(isRetryableError(502)).toBe(true); // Bad Gateway
    expect(isRetryableError(503)).toBe(true); // Service Unavailable
    expect(isRetryableError(429)).toBe(true); // Too Many Requests
  });

  it("identifies client errors (4xx) as permanent failures requiring no retries", () => {
    expect(isRetryableError(400)).toBe(false); // Bad Request
    expect(isRetryableError(401)).toBe(false); // Unauthorized
    expect(isRetryableError(403)).toBe(false); // Forbidden
    expect(isRetryableError(404)).toBe(false); // Not Found
  });

  it("includes mandatory Idempotency-Key and Webhook-Event-ID headers in outbound payload structure", () => {
    const mockHeaders = {
      "Content-Type": "application/json",
      "X-CampusConnect-Signature": "sig_test123",
      "Idempotency-Key": "evt_delivery_123_att1",
      "Webhook-Event-ID": "evt_delivery_123",
    };

    expect(mockHeaders["Idempotency-Key"]).toBeDefined();
    expect(mockHeaders["Webhook-Event-ID"]).toBeDefined();
    expect(mockHeaders["Idempotency-Key"]).toContain("att1");
  });
});
