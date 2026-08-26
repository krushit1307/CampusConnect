import { WebhookDelivery } from "./types.ts";

export const MAX_RETRIES = 5;

// Exponential Backoff intervals:
// Retry 1 (after Attempt 1): 1 minute
// Retry 2 (after Attempt 2): 5 minutes
// Retry 3 (after Attempt 3): 30 minutes
// Retry 4 (after Attempt 4): 120 minutes
export const RETRY_BACKOFF_MINUTES = [0, 1, 5, 30, 120];

export function calculateNextRetry(attempt: number, baseDate: Date = new Date()): Date | null {
  if (attempt >= MAX_RETRIES) {
    return null;
  }
  const backoffMinutes = RETRY_BACKOFF_MINUTES[attempt] ?? 30;
  const nextRetry = new Date(baseDate.getTime());
  nextRetry.setMinutes(nextRetry.getMinutes() + backoffMinutes);
  return nextRetry;
}

export function isRetryableError(statusCode: number | null): boolean {
  if (!statusCode) return true; // Network errors, timeouts
  if (statusCode >= 500 && statusCode < 600) return true; // Server errors
  if (statusCode === 429) return true; // Rate limiting
  return false; // Client errors (4xx) are permanent
}
