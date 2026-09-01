// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

const originalFetch = globalThis.fetch;

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

Deno.test("transit-scooter-sync - handles OPTIONS preflight CORS requests", async () => {
  const req = new Request("http://localhost:8000/transit-scooter-sync", { method: "OPTIONS" });
  const response = await handler(req);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("transit-scooter-sync - rejects non-POST request methods", async () => {
  const req = new Request("http://localhost:8000/transit-scooter-sync", { method: "GET" });
  const response = await handler(req);
  assertEquals(response.status, 405);
  const data = await response.json();
  assertEquals(data.error, "Method not allowed");
});

Deno.test("transit-scooter-sync - validates missing coordinate parameters", async () => {
  const req = new Request("http://localhost:8000/transit-scooter-sync", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const response = await handler(req);
  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
  assertEquals(data.error, "Latitude and Longitude must be numbers.");
});

Deno.test("transit-scooter-sync - validates out-of-range coordinates", async () => {
  const req = new Request("http://localhost:8000/transit-scooter-sync", {
    method: "POST",
    body: JSON.stringify({ latitude: 95.0, longitude: 120.0 }),
  });
  const response = await handler(req);
  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.error.includes("Invalid coordinates"), true);
});

Deno.test(
  "transit-scooter-sync - queries scooters mock deterministically using coordinates",
  async () => {
    const req = new Request("http://localhost:8000/transit-scooter-sync", {
      method: "POST",
      body: JSON.stringify({
        latitude: 30.3564,
        longitude: 76.3647,
        radiusFeet: 200,
        minBattery: 20,
      }),
    });
    const response = await handler(req);
    assertEquals(response.status, 200);

    const data = await response.json();
    assertEquals(data.success, true);
    assertEquals(data.provider, "deterministic-mock");
    assertEquals(Array.isArray(data.scooters), true);

    if (data.scooters.length > 0) {
      const first = data.scooters[0];
      assertEquals(typeof first.id, "string");
      assertEquals(typeof first.batteryPercent, "number");
      assertEquals(first.batteryPercent >= 20, true);
      assertEquals(first.distanceToStopFeet <= 200, true);
      assertEquals(first.deepLink.includes(first.id), true);
    }
  },
);

Deno.test("transit-scooter-sync - respects custom smaller radius parameters", async () => {
  // Query with very small radius to filter out farther scooters
  const req = new Request("http://localhost:8000/transit-scooter-sync", {
    method: "POST",
    body: JSON.stringify({ latitude: 30.3564, longitude: 76.3647, radiusFeet: 30 }),
  });
  const response = await handler(req);
  const data = await response.json();

  data.scooters.forEach((s: any) => {
    assertEquals(s.distanceToStopFeet <= 30, true);
  });
});

Deno.test(
  "transit-scooter-sync - filters scooters below battery percentage threshold",
  async () => {
    const req = new Request("http://localhost:8000/transit-scooter-sync", {
      method: "POST",
      body: JSON.stringify({ latitude: 30.3564, longitude: 76.3647, minBattery: 75 }),
    });
    const response = await handler(req);
    const data = await response.json();

    data.scooters.forEach((s: any) => {
      assertEquals(s.batteryPercent >= 75, true);
    });
  },
);

Deno.test(
  "transit-scooter-sync - integrates with third-party providers when credentials exist",
  async () => {
    // Setup environment keys
    Deno.env.set("BIRD_API_KEY", "mock-bird-key");
    Deno.env.set("LIME_CLIENT_SECRET", "mock-lime-secret");

    // Stub the external mobility api calls
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.includes("api.birdapp.com")) {
        return new Response(
          JSON.stringify({
            birds: [
              {
                id: "bird-1",
                code: "B1",
                latitude: 30.3565,
                longitude: 76.3648,
                battery_level: 80,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("api.li.me")) {
        return new Response(
          JSON.stringify({
            bikes: [{ id: "lime-1", latitude: 30.3563, longitude: 76.3646, battery_percent: 65 }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: "Not mocked" }), { status: 404 });
    };

    try {
      const req = new Request("http://localhost:8000/transit-scooter-sync", {
        method: "POST",
        body: JSON.stringify({ latitude: 30.3564, longitude: 76.3647, radiusFeet: 500 }),
      });

      const response = await handler(req);
      assertEquals(response.status, 200);

      const data = await response.json();
      assertEquals(data.success, true);
      assertEquals(data.provider, "live-aggregated");
      assertEquals(data.scooters.length, 2);

      const providers = data.scooters.map((s: any) => s.provider);
      assertEquals(providers.includes("bird"), true);
      assertEquals(providers.includes("lime"), true);
    } finally {
      restoreFetch();
      Deno.env.delete("BIRD_API_KEY");
      Deno.env.delete("LIME_CLIENT_SECRET");
    }
  },
);

Deno.test(
  "transit-scooter-sync - handles external api query timeout errors gracefully",
  async () => {
    Deno.env.set("BIRD_API_KEY", "mock-bird-key");
    Deno.env.set("LIME_CLIENT_SECRET", "mock-lime-secret");

    // Stub fetch to lock up and wait indefinitely (triggering AbortError on signal)
    globalThis.fetch = () => {
      return new Promise((_, reject) => {
        // Simulate abort event callback immediately when aborted
        const err = new Error("The user aborted a request.");
        err.name = "AbortError";
        setTimeout(() => reject(err), 50);
      });
    };

    try {
      const req = new Request("http://localhost:8000/transit-scooter-sync", {
        method: "POST",
        body: JSON.stringify({ latitude: 30.3564, longitude: 76.3647 }),
      });

      const response = await handler(req);
      // Should return 504 Gateway Timeout or similar when fetch fails with AbortError
      assertEquals(response.status, 504);
      const data = await response.json();
      assertEquals(data.success, false);
      assertEquals(data.error, "Mobility provider query timed out.");
    } finally {
      restoreFetch();
      Deno.env.delete("BIRD_API_KEY");
      Deno.env.delete("LIME_CLIENT_SECRET");
    }
  },
);
