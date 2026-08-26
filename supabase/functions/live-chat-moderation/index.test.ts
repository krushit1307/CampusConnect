// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

Deno.test("live-chat-moderation - handles OPTIONS request", async () => {
  const req = new Request("http://localhost:8000/live-chat-moderation", {
    method: "OPTIONS",
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
});

Deno.test("live-chat-moderation - ignores other payload tables", async () => {
  const req = new Request("http://localhost:8000/live-chat-moderation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "INSERT",
      table: "posts",
      record: {},
    }),
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.message, "Ignored payload");
});

Deno.test("live-chat-moderation - returns 400 for missing content/userId", async () => {
  const req = new Request("http://localhost:8000/live-chat-moderation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "INSERT",
      table: "event_chat_messages",
      record: { id: "m1" },
    }),
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.error, "Missing parameters");
});
