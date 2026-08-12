// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

Deno.test("verify-vote - missing parameters returns 400", async () => {
  const req = new Request("http://localhost:8000/verify-vote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}), // Missing required parameters
  });

  const response = await handler(req);
  assertEquals(response.status, 400);

  const data = await response.json();
  assertEquals(data.error, "Missing required parameters");
});

Deno.test("verify-vote - handles OPTIONS request for CORS", async () => {
  const req = new Request("http://localhost:8000/verify-vote", {
    method: "OPTIONS",
  });

  const response = await handler(req);
  assertEquals(response.status, 200);
});
