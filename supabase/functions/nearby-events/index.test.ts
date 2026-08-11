// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

const originalFetch = globalThis.fetch;

// Stub the Supabase PostgREST API so tests run without any network access.
function stubSupabaseApi(mockEvents: unknown[] = []) {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();

    if (url.includes("/rest/v1/rpc/get_events_nearby")) {
      return new Response(JSON.stringify(mockEvents), {
        status: 200,
        headers: { "Content-Type": "application/json", "Content-Profile": "public" },
      });
    }

    return new Response(JSON.stringify({ error: "Not mocked" }), { status: 404 });
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

Deno.env.set("SUPABASE_URL", "https://mock.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "mock-anon-key");

Deno.test("nearby-events - handles OPTIONS request for CORS", async () => {
  const req = new Request("http://localhost:8000/nearby-events", { method: "OPTIONS" });
  const response = await handler(req);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("nearby-events - rejects non-GET methods", async () => {
  const req = new Request("http://localhost:8000/nearby-events", {
    method: "POST",
    body: "{}",
  });
  const response = await handler(req);
  assertEquals(response.status, 405);
});

Deno.test("nearby-events - rejects missing coordinates", async () => {
  const req = new Request("http://localhost:8000/nearby-events?lat=37.7749");
  const response = await handler(req);
  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.error.includes("lat and lng"), true);
});

Deno.test("nearby-events - rejects out-of-range latitude", async () => {
  const req = new Request("http://localhost:8000/nearby-events?lat=91&lng=-122.4194");
  const response = await handler(req);
  assertEquals(response.status, 400);
});

Deno.test("nearby-events - rejects out-of-range longitude", async () => {
  const req = new Request("http://localhost:8000/nearby-events?lat=37.7749&lng=-181");
  const response = await handler(req);
  assertEquals(response.status, 400);
});

Deno.test("nearby-events - rejects invalid radius", async () => {
  const req = new Request(
    "http://localhost:8000/nearby-events?lat=37.7749&lng=-122.4194&radius=999999999",
  );
  const response = await handler(req);
  assertEquals(response.status, 400);
});

Deno.test("nearby-events - returns nearby events with default 500m radius", async () => {
  stubSupabaseApi([
    { id: "evt-1", title: "Hackathon", distance_meters: 120.5 },
    { id: "evt-2", title: "Open Mic", distance_meters: 320.1 },
  ]);
  try {
    const req = new Request("http://localhost:8000/nearby-events?lat=37.7749&lng=-122.4194");
    const response = await handler(req);
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(data.success, true);
    assertEquals(data.count, 2);
    assertEquals(data.radius_meters, 500);
    assertEquals(data.events.length, 2);
    assertEquals(data.events[0].title, "Hackathon");
  } finally {
    restoreFetch();
  }
});

Deno.test("nearby-events - respects a custom radius", async () => {
  stubSupabaseApi([{ id: "evt-1", title: "Far Event", distance_meters: 480.9 }]);
  try {
    const req = new Request(
      "http://localhost:8000/nearby-events?lat=37.7749&lng=-122.4194&radius=1000",
    );
    const response = await handler(req);
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(data.radius_meters, 1000);
    assertEquals(data.count, 1);
  } finally {
    restoreFetch();
  }
});

Deno.test("nearby-events - surfaces RPC failures as 500", async () => {
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes("/rest/v1/rpc/get_events_nearby")) {
      return new Response(
        JSON.stringify({ code: "PGRST116", message: "function not found", details: "..." }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: "Not mocked" }), { status: 404 });
  };
  try {
    const req = new Request("http://localhost:8000/nearby-events?lat=37.7749&lng=-122.4194");
    const response = await handler(req);
    assertEquals(response.status, 500);
    const data = await response.json();
    assertEquals(data.error.includes("function not found"), true);
  } finally {
    restoreFetch();
  }
});
