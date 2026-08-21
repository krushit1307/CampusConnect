import { describe, it, expect } from "vitest";
import {
  generateWebhookSecretKey,
  generateHmacSha256Signature,
  verifyWebhookSignature,
  formatWebhookPayload,
} from "./webhookSigner";

describe("Webhook Cryptographic HMAC Signer Utility (#3543)", () => {
  const secretKey = "whsec_test_secret_key_1234567890abcdef";
  const payload = {
    event: "rsvp.created",
    data: {
      eventId: "evt-123",
      attendeeName: "Alex Rivera",
      email: "alex@campus.edu",
    },
  };

  it("generates secret keys starting with whsec_ prefix", () => {
    const key = generateWebhookSecretKey();
    expect(key).toMatch(/^whsec_[a-f0-9]{32}$/);
  });

  it("generates and cryptographically verifies valid HMAC SHA-256 signatures", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateHmacSha256Signature(secretKey, payload, timestamp);

    expect(signature).toContain(`t=${timestamp},v1=`);

    const result = verifyWebhookSignature(secretKey, payload, signature);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects signatures when payload content has been tampered with", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateHmacSha256Signature(secretKey, payload, timestamp);

    const tamperedPayload = { ...payload, data: { ...payload.data, attendeeName: "Impostor" } };
    const result = verifyWebhookSignature(secretKey, tamperedPayload, signature);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("HMAC SHA-256 signature mismatch");
  });

  it("rejects signatures when secret key is incorrect", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateHmacSha256Signature(secretKey, payload, timestamp);

    const result = verifyWebhookSignature("whsec_wrong_key", payload, signature);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("HMAC SHA-256 signature mismatch");
  });

  it("protects against replay attacks with expired timestamps (>300 seconds old)", () => {
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s in the past
    const signature = generateHmacSha256Signature(secretKey, payload, expiredTimestamp);

    const result = verifyWebhookSignature(secretKey, payload, signature, 300);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("replay attack protection");
  });

  it("formats standardized webhook event payloads", () => {
    const formatted = formatWebhookPayload("rsvp.created", "club-cs-1", { rsvpId: "rsvp-99" });

    expect(formatted.event).toBe("rsvp.created");
    expect(formatted.club_id).toBe("club-cs-1");
    expect(formatted.data.rsvpId).toBe("rsvp-99");
    expect(formatted.id).toContain("evt_wh_");
  });
});
