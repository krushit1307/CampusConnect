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

Deno.test(
  "limitRate - accepts custom higher thresholds for high-traffic peak endpoints",
  async () => {
    const req = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "192.168.1.100",
      },
    });

    // Higher threshold for toggle-rsvp during peak hours (60 requests/min)
    const response = await limitRate(req, "toggle-rsvp", { limit: 60, windowMs: 60000 });
    assertEquals(response, null);
  },
);

Deno.test("limitRate - handles missing headers and defaults gracefully", async () => {
  const req = new Request("https://example.com");

  // Requests without x-forwarded-for should default IP and fail open if redis is unconfigured
  const response = await limitRate(req, "toggle-rsvp");
  assertEquals(response, null);
});
