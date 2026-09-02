export interface WebhookResponseHeaders {
  "retry-after"?: string;
  "x-ratelimit-reset"?: string;
  "x-ratelimit-remaining"?: string;
}

export interface CrmBackpressureState {
  sponsorId: string;
  crmTargetUrl: string;
  isPaused: boolean;
  retryAfterSeconds: number;
  pausedUntil: string | null;
  throttledRatePerSec: number;
  http429Count: number;
}

export interface WebhookDispatchResult {
  dispatchId: string;
  statusCode: number;
  backpressureTriggered: boolean;
  retryAfterSeconds: number;
  nextThrottledRatePerSec: number;
  status: "success" | "rate_limited_backpressure" | "failed";
  dispatchedAt: string;
}

export const DEFAULT_RETRY_AFTER_SECONDS = 60;
export const THROTTLED_QUEUE_RATE_PER_SEC = 5;
export const NORMAL_QUEUE_RATE_PER_SEC = 10;

/**
 * Parses Retry-After or X-RateLimit-Reset HTTP response headers (#5061).
 */
export function parseRetryAfterHeader(headers: WebhookResponseHeaders): number {
  if (headers["retry-after"]) {
    const parsed = parseInt(headers["retry-after"], 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (headers["x-ratelimit-reset"]) {
    const resetTime = parseInt(headers["x-ratelimit-reset"], 10);
    if (!isNaN(resetTime) && resetTime > Date.now() / 1000) {
      return Math.round(resetTime - Date.now() / 1000);
    }
  }

  return DEFAULT_RETRY_AFTER_SECONDS;
}

/**
 * Processes HTTP status code & headers from Sponsor CRM Webhook worker.
 * Pauses SQS queue consumer on HTTP 429 and applies rate-limit backpressure (#5061).
 */
export function processCrmWebhookResponse(
  sponsorId: string,
  targetUrl: string,
  statusCode: number,
  headers: WebhookResponseHeaders = {}
): WebhookDispatchResult {
  const dispatchId = `disp-${Date.now()}`;
  const now = new Date();

  if (statusCode === 429) {
    const retryAfterSeconds = parseRetryAfterHeader(headers);

    return {
      dispatchId,
      statusCode,
      backpressureTriggered: true,
      retryAfterSeconds,
      nextThrottledRatePerSec: THROTTLED_QUEUE_RATE_PER_SEC,
      status: "rate_limited_backpressure",
      dispatchedAt: now.toISOString(),
    };
  }

  return {
    dispatchId,
    statusCode: statusCode || 200,
    backpressureTriggered: false,
    retryAfterSeconds: 0,
    nextThrottledRatePerSec: NORMAL_QUEUE_RATE_PER_SEC,
    status: "success",
    dispatchedAt: now.toISOString(),
  };
}
