import { WebhookDelivery } from "./types.ts";

const MAX_RETRIES = 5;

// Attempt 1 -> Attempt 2 (1 min)
// Attempt 2 -> Attempt 3 (5 mins)
// Attempt 3 -> Attempt 4 (15 mins)
// Attempt 4 -> Attempt 5 (1 hour)
const RETRY_BACKOFF_MINUTES = [0, 1, 5, 15, 60];

export function calculateNextRetry(attempt: number): Date | null {
  if (attempt >= MAX_RETRIES) {
    return null;
  }
  const backoffMinutes = RETRY_BACKOFF_MINUTES[attempt] || 60;
  const nextRetry = new Date();
  nextRetry.setMinutes(nextRetry.getMinutes() + backoffMinutes);
  return nextRetry;
}

export function isRetryableError(statusCode: number | null): boolean {
  if (!statusCode) return true; // Network errors, timeouts
  if (statusCode >= 500 && statusCode < 600) return true; // Server errors
  if (statusCode === 429) return true; // Rate limiting
  return false; // Client errors (4xx) are permanent
}
