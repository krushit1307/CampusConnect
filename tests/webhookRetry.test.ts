import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  calculateNextRetry,
  isRetryableError,
} from "../supabase/functions/publish-webhooks/retry.ts";

Deno.test("calculateNextRetry applies exponential backoff", () => {
  const t1 = calculateNextRetry(1);
  const t2 = calculateNextRetry(2);
  const t3 = calculateNextRetry(3);
  const t4 = calculateNextRetry(4);
  const t5 = calculateNextRetry(5);

  assertEquals(t1 !== null, true);
  assertEquals(t2 !== null, true);
  assertEquals(t3 !== null, true);
  assertEquals(t4 !== null, true);
  assertEquals(t5 === null, true); // MAX_RETRIES reached
});

Deno.test("isRetryableError identifies retryable status codes", () => {
  assertEquals(isRetryableError(null), true); // Network error
  assertEquals(isRetryableError(500), true);
  assertEquals(isRetryableError(503), true);
  assertEquals(isRetryableError(429), true);

  assertEquals(isRetryableError(400), false);
  assertEquals(isRetryableError(401), false);
  assertEquals(isRetryableError(404), false);
});
