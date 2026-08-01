// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { decodeJwtPayload, getSessionIdFromToken } from "./session-token.ts";

function makeJwt(payload: Record<string, unknown>): string {
  const enc = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.signature`;
}

Deno.test("decodeJwtPayload - parses base64url payload", () => {
  const jwt = makeJwt({ sub: "user-1", session_id: "sess-123" });
  const payload = decodeJwtPayload(jwt);
  assertEquals(payload?.sub, "user-1");
  assertEquals(payload?.session_id, "sess-123");
});

Deno.test("getSessionIdFromToken - returns the session_id claim", () => {
  const jwt = makeJwt({ sub: "user-1", session_id: "sess-123" });
  assertEquals(getSessionIdFromToken(jwt), "sess-123");
});

Deno.test("getSessionIdFromToken - returns null for malformed tokens", () => {
  assertEquals(getSessionIdFromToken(""), null);
  assertEquals(getSessionIdFromToken("not-a-jwt"), null);
  assertEquals(getSessionIdFromToken("header.payload"), null);
});

Deno.test("getSessionIdFromToken - returns null when session_id is missing", () => {
  const jwt = makeJwt({ sub: "user-1" });
  assertEquals(getSessionIdFromToken(jwt), null);
});

Deno.test("getSessionIdFromToken - returns null for invalid base64 payload", () => {
  assertEquals(getSessionIdFromToken("aaa.###.ccc"), null);
});
