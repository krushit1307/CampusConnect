// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { limitRate, getUserIdFromAuthHeader } from "./middleware.ts";

Deno.test("limitRate - skips and fails open if redis is not configured", async () => {
  const req = new Request("https://example.com", {
    headers: {
      "x-forwarded-for": "1.2.3.4",
    },
  });

  const response = await limitRate(req, "test-function");
  // If Redis client is null (not configured), it should log a warning and return null (allowing the request)
  assertEquals(response, null);
});

Deno.test(
  "limitRate - accepts custom higher thresholds for high-traffic peak endpoints",
  async () => {
    const req = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "192.168.1.100",
      },
    });

    // Higher threshold for toggle-rsvp during peak hours (60 requests/min)
    const response = await limitRate(req, "toggle-rsvp", { limit: 60, windowMs: 60000 });
    assertEquals(response, null);
  },
);

Deno.test("limitRate - handles missing headers and defaults gracefully", async () => {
  const req = new Request("https://example.com");

  // Requests without x-forwarded-for should default IP and fail open if redis is unconfigured
  const response = await limitRate(req, "toggle-rsvp");
  assertEquals(response, null);
});

Deno.test("getUserIdFromAuthHeader - decodes JWT user sub ID correctly", () => {
  const token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0Y2M3MWE3NC1iNTJlLTRiNDctYmE4OC03NTE3YzViNjFiMmUiLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature";
  const authHeader = `Bearer ${token}`;

  const userId = getUserIdFromAuthHeader(authHeader);
  assertEquals(userId, "4cc71a74-b52e-4b47-ba88-7517c5b61b2e");
});

Deno.test("getUserIdFromAuthHeader - returns null for malformed or missing headers", () => {
  assertEquals(getUserIdFromAuthHeader(null), null);
  assertEquals(getUserIdFromAuthHeader(""), null);
  assertEquals(getUserIdFromAuthHeader("Bearer malformed.token"), null);
  assertEquals(getUserIdFromAuthHeader("Basic abc"), null);
});

async function testHmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.test("validateSignature - rejects requests missing signature headers", async () => {
  const req = new Request("https://example.com/api/test", { method: "POST" });
  const response = await validateSignature(req);
  assertEquals(response?.status, 400);
});

Deno.test("validateSignature - rejects requests with expired timestamps", async () => {
  const expiredTime = (Date.now() - 360000).toString(); // 6 minutes ago
  const req = new Request("https://example.com/api/test", {
    method: "POST",
    headers: {
      "X-Request-Signature": "dummy",
      "X-Request-Timestamp": expiredTime,
      "X-Request-Nonce": "nonce-123",
    },
  });
  const response = await validateSignature(req);
  assertEquals(response?.status, 401);
});

Deno.test("validateSignature - validates correct signature successfully", async () => {
  const method = "POST";
  const path = "/api/test";
  const timestamp = Date.now().toString();
  const nonce = "unique-nonce-123";
  const bodyText = JSON.stringify({ hello: "world" });
  const token = "my-secret-jwt-token";

  const message = `${method}:${path}:${timestamp}:${nonce}:${bodyText}`;
  const signature = await testHmacSha256(token, message);

  const req = new Request(`https://example.com${path}`, {
    method,
    body: bodyText,
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-Request-Signature": signature,
      "X-Request-Timestamp": timestamp,
      "X-Request-Nonce": nonce,
    },
  });

  const response = await validateSignature(req);
  assertEquals(response, null);
});

