import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { z } from "https://esm.sh/zod@3.24.2";
import { parseJsonBody } from "./validation.ts";

const testSchema = z
  .object({
    eventId: z.string().uuid(),
    capacity: z.number().int().positive(),
  })
  .strict();

Deno.test("parseJsonBody accepts a valid payload", async () => {
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventId: "4c3f56c8-6f10-4f2b-9c1e-1e0f7a2b3c4d",
      capacity: 25,
    }),
  });
  const result = await parseJsonBody(testSchema, req);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.capacity, 25);
  }
});

Deno.test("parseJsonBody rejects negative capacity with a 400 and field errors", async () => {
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventId: "4c3f56c8-6f10-4f2b-9c1e-1e0f7a2b3c4d",
      capacity: -50,
    }),
  });
  const result = await parseJsonBody(testSchema, req);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.response.status, 400);
    const body = await result.response.json();
    assertEquals(body.error, "Invalid request body");
    assertEquals(Array.isArray(body.fields.capacity), true);
  }
});

Deno.test("parseJsonBody rejects missing title field", async () => {
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ capacity: 10 }),
  });
  const result = await parseJsonBody(testSchema, req);
  assertEquals(result.ok, false);
  if (!result.ok) {
    const body = await result.response.json();
    assertEquals(Array.isArray(body.fields.eventId), true);
  }
});

Deno.test("parseJsonBody rejects unknown extra fields (strict mode)", async () => {
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventId: "4c3f56c8-6f10-4f2b-9c1e-1e0f7a2b3c4d",
      capacity: 10,
      admin: true,
    }),
  });
  const result = await parseJsonBody(testSchema, req);
  assertEquals(result.ok, false);
  if (!result.ok) {
    const body = await result.response.json();
    assertEquals(Array.isArray(body.fields._), true);
  }
});

Deno.test("parseJsonBody maps malformed JSON to a clean 400", async () => {
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not json",
  });
  const result = await parseJsonBody(testSchema, req);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.response.status, 400);
    const body = await result.response.json();
    assertEquals(body.error, "Invalid JSON body");
  }
});
