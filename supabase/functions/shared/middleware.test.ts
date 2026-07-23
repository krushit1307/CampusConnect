// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { limitRate } from "./middleware.ts";

Deno.test("limitRate - skips and fails open if redis is not configured", async () => {
  const req = new Request("https://example.com", {
    headers: {
      "x-forwarded-for": "1.2.3.4",
    },
  });

  const response = await limitRate(req, "test-function");
  // If Redis client is null (not configured), it should log a warning and return null (allowing the request)
  assertEquals(response, null);
});
