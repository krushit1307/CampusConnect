// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

Deno.test("cleanup-orphaned-storage - handles OPTIONS request for CORS", async () => {
  const req = new Request("http://localhost:8000/cleanup-orphaned-storage", {
    method: "OPTIONS",
  });

  const response = await handler(req);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("cleanup-orphaned-storage - missing authorization returns 401", async () => {
  const req = new Request("http://localhost:8000/cleanup-orphaned-storage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const response = await handler(req);
  assertEquals(response.status, 401);

  const data = await response.json();
  assertEquals(data.error, "Unauthorized");
});

Deno.test("cleanup-orphaned-storage - invalid token returns 401", async () => {
  const req = new Request("http://localhost:8000/cleanup-orphaned-storage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-secret-token",
    },
  });

  const response = await handler(req);
  assertEquals(response.status, 401);

  const data = await response.json();
  assertEquals(data.error, "Unauthorized");
});
