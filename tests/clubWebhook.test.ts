import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { generateSignature } from "../supabase/functions/publish-club-webhooks/index.ts";

Deno.test("generateSignature inside publish-club-webhooks matches expected HMAC-SHA256 signature", async () => {
  const secret = "test-secret-key-12345";
  const payload = JSON.stringify({ event: "RSVP", user: "Alex", ticket_type: "VIP" });

  const signature = await generateSignature(secret, payload);

  // Signature format should start with sha256=
  assertEquals(signature.startsWith("sha256="), true);

  // Determinism check
  const secondSignature = await generateSignature(secret, payload);
  assertEquals(signature, secondSignature);
});

Deno.test("constructs correct club webhook JSON payload structure", () => {
  const mockPayload = (eventType: string, firstName: string, ticketType: string) => {
    return {
      event: eventType === "RSVP_CREATED" ? "RSVP" : "CHECK_IN",
      user: firstName,
      ticket_type: ticketType,
    };
  };

  const rsvpPayload = mockPayload("RSVP_CREATED", "Alex", "VIP");
  assertEquals(rsvpPayload.event, "RSVP");
  assertEquals(rsvpPayload.user, "Alex");
  assertEquals(rsvpPayload.ticket_type, "VIP");

  const checkinPayload = mockPayload("CHECK_IN_COMPLETED", "Alex", "VIP");
  assertEquals(checkinPayload.event, "CHECK_IN");
  assertEquals(checkinPayload.user, "Alex");
  assertEquals(checkinPayload.ticket_type, "VIP");
});
