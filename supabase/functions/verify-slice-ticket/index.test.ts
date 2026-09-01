// @ts-nocheck
// Tests for the verify-slice-ticket edge function: the bouncer's QR burn
// flow for fractional ticket slices (#5375).
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

function mockClient(result: { data: unknown; error: unknown }) {
  return {
    rpc: async () => result,
  };
}

function post(body: Record<string, unknown>): Request {
  return new Request("https://example.com", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

Deno.test("verify-slice-ticket - OPTIONS is allowed", async () => {
  const res = await handler(new Request("https://example.com", { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
});

Deno.test("verify-slice-ticket - missing sliceToken returns 400", async () => {
  const res = await handler(post({}), mockClient({ data: null, error: null }));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "Missing sliceToken");
});

Deno.test("verify-slice-ticket - malformed sliceToken returns 400", async () => {
  const res = await handler(
    post({ sliceToken: "not-a-uuid" }),
    mockClient({ data: null, error: null }),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "Invalid slice token format");
});

Deno.test("verify-slice-ticket - successful burn maps to 200", async () => {
  const res = await handler(
    post({ sliceToken: "00000000-0000-0000-0000-000000000001" }),
    mockClient({
      data: {
        success: true,
        slice_id: "s1",
        event_id: "e1",
        owner_user_id: "u1",
        slice_start: "2026-08-31T20:00:00Z",
        slice_end: "2026-08-31T21:00:00Z",
        burned_at: "2026-08-31T20:15:00Z",
      },
      error: null,
    }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.slice_id, "s1");
});

Deno.test("verify-slice-ticket - RPC rejection (window not open) maps to 409", async () => {
  const res = await handler(
    post({ sliceToken: "00000000-0000-0000-0000-000000000002" }),
    mockClient({
      data: {
        success: false,
        error: "Entry not open yet. Window starts at 2026-09-01T00:00:00+00:00",
      },
      error: null,
    }),
  );
  assertEquals(res.status, 409);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.error.includes("Entry not open yet"), true);
});

Deno.test("verify-slice-ticket - RPC transport error maps to 500", async () => {
  const res = await handler(
    post({ sliceToken: "00000000-0000-0000-0000-000000000003" }),
    mockClient({ data: null, error: new Error("rpc down") }),
  );
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, "Failed to verify slice");
});

Deno.test("verify-slice-ticket - eventId cross-check rejects wrong event", async () => {
  const res = await handler(
    post({
      sliceToken: "00000000-0000-0000-0000-000000000004",
      eventId: "expected-event",
    }),
    mockClient({
      data: { success: true, event_id: "other-event" },
      error: null,
    }),
  );
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, "Slice does not belong to this event");
});
