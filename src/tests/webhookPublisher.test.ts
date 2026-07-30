// Mock test files for publishing and delivery.
// In a real setup, we would use a mock server (e.g. msw) or Deno's mock fetch to test the actual POST requests.
import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { buildPayload } from "../supabase/functions/publish-webhooks/payload.ts";

Deno.test("buildPayload constructs standard JSON format", () => {
  const payload = buildPayload("event.created", "club-123", { id: "evt-1", title: "Test" });

  assertEquals(payload.event, "event.created");
  assertEquals(payload.club.id, "club-123");
  assertEquals(payload.data.title, "Test");
  assertEquals(typeof payload.timestamp, "string");
});
