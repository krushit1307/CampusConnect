import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { limitRate } from "../shared/rate_limiter.ts";

// Utility to create a mock request with a specific IP
function createMockRequest(ip: string): Request {
  return new Request("http://localhost/request-password-reset", {
    method: "POST",
    headers: {
      "x-forwarded-for": ip,
      "content-type": "application/json",
    },
  });
}

// Global mock for fetch to intercept Upstash Redis REST calls
const originalFetch = globalThis.fetch;
const redisStore = new Map<string, number[]>(); // key -> array of timestamps

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input.toString();
  if (url.includes("upstash.io")) {
    // Mock the pipeline exec logic from limitRate
    // We can simulate the basic logic of zremrangebyscore, zadd, zcard, expire
    // Since we know limitRate creates a pipeline and executes it in one go.
    try {
      const body = JSON.parse(init?.body as string);
      // The body is an array of Redis commands for the pipeline
      // Find the key which is the second element of the first command
      const key = body[0][1];
      const now = Date.now();
      const clearBefore = body[0][3]; // zremrangebyscore key 0 clearBefore

      // 1. ZREMRANGEBYSCORE
      let timestamps = redisStore.get(key) || [];
      timestamps = timestamps.filter((t) => t > clearBefore);

      // 2. ZADD
      const score = body[1][2]; // zadd key score member
      timestamps.push(Number(score) || now);

      // 3. ZCARD
      const count = timestamps.length;

      redisStore.set(key, timestamps);

      // Return a mocked array matching what pipeline.exec() returns
      // exec() returns an array of results for each command.
      // [zremrangebyscore result, zadd result, zcard result, expire result]
      return new Response(
        JSON.stringify([{ result: "OK" }, { result: 1 }, { result: count }, { result: 1 }]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (e) {
      console.error("Mock Redis Fetch Error:", e);
      return new Response(JSON.stringify({ error: "Mock Error" }), { status: 500 });
    }
  }
  return originalFetch(input, init);
};

// Ensure Redis is "configured" for the test
Deno.env.set("UPSTASH_REDIS_REST_URL", "https://mock.upstash.io");
Deno.env.set("UPSTASH_REDIS_REST_TOKEN", "mock-token");

Deno.test("Password Reset Rate Limiting Scenarios", async (t) => {
  const emailLimit = 3;
  const ipLimit = 5;
  const windowMs = 3600000; // 1 hour

  // Handler simulation
  async function simulateHandler(ip: string, email: string) {
    const req = createMockRequest(ip);

    // 1. IP check
    const ipRes = await limitRate(req, "test-pw-reset-ip", { limit: ipLimit, windowMs });
    if (ipRes) return ipRes;

    // 2. Email check
    const emailRes = await limitRate(req, "test-pw-reset-email", {
      limit: emailLimit,
      windowMs,
      identifier: email,
    });
    if (emailRes) return emailRes;

    return new Response(
      JSON.stringify({ message: "If this email exists, a reset link has been sent." }),
      { status: 200 },
    );
  }

  // Clear mock store before each test
  redisStore.clear();

  await t.step("First 3 requests succeed", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await simulateHandler("1.1.1.1", "test@example.com");
      assertEquals(res.status, 200);
    }
  });

  await t.step("4th request for the same email returns 429", async () => {
    const res = await simulateHandler("1.1.1.1", "test@example.com");
    assertEquals(res.status, 429);
  });

  await t.step("Changing IP still fails after the email limit is reached", async () => {
    const res = await simulateHandler("2.2.2.2", "test@example.com");
    assertEquals(res.status, 429);
  });

  await t.step("Different emails respect the IP limit", async () => {
    // We already have 1 request from 2.2.2.2 (which failed due to email, but it still incremented IP counter!)
    // Wait, IP limit runs BEFORE Email limit. So the IP counter for 2.2.2.2 is now at 1.

    // Let's make 4 more requests from 2.2.2.2 with different emails to reach the IP limit (5)
    for (let i = 0; i < 4; i++) {
      const res = await simulateHandler("2.2.2.2", `different${i}@example.com`);
      assertEquals(res.status, 200);
    }

    // The 6th request from the same IP (but new email) should fail because of IP limit
    const res = await simulateHandler("2.2.2.2", "another-new@example.com");
    assertEquals(res.status, 429);
  });
});
