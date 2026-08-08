// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { REDACTED, redactPII, sanitizeRow } from "./pii.ts";

Deno.test("redactPII - redacts top-level sensitive keys", () => {
  const out = redactPII({
    id: "uuid-1",
    email: "user@campusconnect.com",
    password: "hunter2",
    status: "approved",
  });
  assertEquals(out.email, REDACTED);
  assertEquals(out.password, REDACTED);
  assertEquals(out.id, "uuid-1");
  assertEquals(out.status, "approved");
});

Deno.test("redactPII - redacts nested sensitive keys", () => {
  const out = redactPII({
    id: "uuid-2",
    profile: {
      first_name: "Ada",
      last_name: "Lovelace",
      avatar_url: "https://cdn.example.com/ada.jpg",
      notification_preferences: { rsvps: true },
    },
  });
  assertEquals(out.profile.first_name, REDACTED);
  assertEquals(out.profile.last_name, REDACTED);
  assertEquals(out.profile.avatar_url, REDACTED);
  assertEquals(out.profile.notification_preferences.rsvps, true);
});

Deno.test("redactPII - redacts auth-style headers and card numbers", () => {
  const out = redactPII({
    authorization: "Bearer eyJhbGciOi",
    x_api_token: "tok_abc",
    payment: { card_number: "4242 4242 4242 4242", last_four: "4242" },
  });
  assertEquals(out.authorization, REDACTED);
  assertEquals(out.x_api_token, REDACTED);
  assertEquals(out.payment.card_number, REDACTED);
  assertEquals(out.payment.last_four, "4242");
});

Deno.test("redactPII - redacts phone / ssn / dob", () => {
  const out = redactPII({ phone: "+1-555-0100", ssn: "123-45-6789", date_of_birth: "2000-01-01" });
  assertEquals(out.phone, REDACTED);
  assertEquals(out.ssn, REDACTED);
  assertEquals(out.date_of_birth, REDACTED);
});

Deno.test("redactPII - matches keys case-insensitively", () => {
  const out = redactPII({ EMAIL: "x@y.z", Password: "p", Authorization: "Bearer t" });
  assertEquals(out.EMAIL, REDACTED);
  assertEquals(out.Password, REDACTED);
  assertEquals(out.Authorization, REDACTED);
});

Deno.test("redactPII - redacts inside arrays", () => {
  const out = redactPII({ users: [{ email: "a@b.c" }, { email: "d@e.f" }] });
  assertEquals(out.users[0].email, REDACTED);
  assertEquals(out.users[1].email, REDACTED);
});

Deno.test("redactPII - handles circular references without throwing", () => {
  const obj: Record<string, unknown> = { id: "1", email: "a@b.c" };
  obj.self = obj;
  const out = redactPII(obj);
  assertEquals(out.email, REDACTED);
  assertEquals(out.self, out);
});

Deno.test("redactPII - passes primitives and null through unchanged", () => {
  assertEquals(redactPII(null), null);
  assertEquals(redactPII(42), 42);
  assertEquals(redactPII("plain"), "plain");
  assertEquals(redactPII(true), true);
});

Deno.test("sanitizeRow - returns null for nullish or non-object input", () => {
  assertEquals(sanitizeRow(null), null);
  assertEquals(sanitizeRow(undefined), null);
  assertEquals(sanitizeRow("string"), null);
});

Deno.test("sanitizeRow - returns a PII-safe copy for objects", () => {
  const out = sanitizeRow({ id: "uuid-9", email: "a@b.c", event_id: "e-1" });
  assertEquals(out!.email, REDACTED);
  assertEquals(out!.id, "uuid-9");
  assertEquals(out!.event_id, "e-1");
});
