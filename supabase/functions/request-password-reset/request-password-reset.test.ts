// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

Deno.test("request-password-reset handler - OPTIONS method", async () => {
  const req = new Request("https://example.com", {
    method: "OPTIONS",
  });

  const response = await handler(req);
  assertEquals(response.status, 200);
  const text = await response.text();
  assertEquals(text, "ok");
});

Deno.test("request-password-reset handler - missing email parameter", async () => {
  const req = new Request("https://example.com", {
    method: "POST",
    body: JSON.stringify({}), // Empty body
  });

  const response = await handler(req);
  assertEquals(response.status, 400);
  const json = await response.json();
  assertEquals(json.error, "Email is required");
});
