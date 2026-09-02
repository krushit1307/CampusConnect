import { describe, it, expect } from "vitest";
import {
  parseRetryAfterHeader,
  processCrmWebhookResponse,
} from "./sponsorCrmRateLimitBackpressure";

describe("Sponsor Lead CRM Webhook Rate Limit Backpressure Utility (#5061)", () => {
  it("parses Retry-After header cleanly", () => {
    const delay = parseRetryAfterHeader({ "retry-after": "45" });
    expect(delay).toBe(45);
  });

  it("triggers backpressure, pauses SQS queue, and throttles rate to 5 req/sec on HTTP 429", () => {
    const result = processCrmWebhookResponse(
      "sponsor-sf-1",
      "https://salesforce.sponsor.com/api/v1/leads",
      429,
      { "retry-after": "60" }
    );

    expect(result.backpressureTriggered).toBe(true);
    expect(result.retryAfterSeconds).toBe(60);
    expect(result.nextThrottledRatePerSec).toBe(5);
    expect(result.status).toBe("rate_limited_backpressure");
  });

  it("returns normal 10 req/sec rate on HTTP 200 success response", () => {
    const result = processCrmWebhookResponse(
      "sponsor-sf-1",
      "https://salesforce.sponsor.com/api/v1/leads",
      200
    );

    expect(result.backpressureTriggered).toBe(false);
    expect(result.retryAfterSeconds).toBe(0);
    expect(result.nextThrottledRatePerSec).toBe(10);
    expect(result.status).toBe("success");
  });
});
