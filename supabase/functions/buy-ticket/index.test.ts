import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const originalFetch = globalThis.fetch;
const redisLocks = new Map<string, string>(); // lockKey -> lockValue

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input.toString();
  if (url.includes("upstash.io")) {
    try {
      const body = JSON.parse(init?.body as string);
      const command = body[0]; // e.g. "SET" or "EVAL"

      if (command === "SET") {
        const key = body[1];
        const val = body[2];
        const nx = body[3] === "NX" || body[4] === "NX";

        if (nx && redisLocks.has(key)) {
          // Already locked: return null/failure
          return new Response(JSON.stringify({ result: null }), { status: 200 });
        }

        redisLocks.set(key, val);
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      }

      if (command === "EVAL") {
        const key = body[3];
        const val = body[4];
        if (redisLocks.get(key) === val) {
          redisLocks.delete(key);
          return new Response(JSON.stringify({ result: 1 }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: 0 }), { status: 200 });
      }

      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    } catch {
      return new Response(JSON.stringify({ error: "Mock Error" }), { status: 500 });
    }
  }
  return originalFetch(input, init);
};

// Set env mock keys
Deno.env.set("UPSTASH_REDIS_REST_URL", "https://mock-upstash.io");
Deno.env.set("UPSTASH_REDIS_REST_TOKEN", "mock-token");

Deno.test("Buy Ticket - Redlock distributed lock acquisition and release", async () => {
  redisLocks.clear();

  // Try to acquire the same lock concurrently
  const lockKey = "ticket_lock_event123";
  const client1Uuid = "uuid-1";

  // Client 1 sets lock
  const res1 = await fetch("https://mock-upstash.io", {
    method: "POST",
    body: JSON.stringify(["SET", lockKey, client1Uuid, "NX", "PX", 5000]),
  });
  const data1 = await res1.json();
  assertEquals(data1.result, "OK");

  // Client 2 attempts to lock (fails)
  const res2 = await fetch("https://mock-upstash.io", {
    method: "POST",
    body: JSON.stringify(["SET", lockKey, "uuid-2", "NX", "PX", 5000]),
  });
  const data2 = await res2.json();
  assertEquals(data2.result, null);

  // Client 1 releases lock
  const res3 = await fetch("https://mock-upstash.io", {
    method: "POST",
    body: JSON.stringify(["EVAL", "lua-script", 1, lockKey, client1Uuid]),
  });
  const data3 = await res3.json();
  assertEquals(data3.result, 1);
});
