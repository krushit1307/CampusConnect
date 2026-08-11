import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bitsToString,
  createImageDataContainer,
  embedLSBData,
  extractLSBData,
  sha256Hex,
  signTicketPayload,
  stringToBits,
  verifyTicketPayload,
} from "./steganography";

describe("steganography LSB module", () => {
  it("converts strings to bit arrays and back accurately", () => {
    const original = "CampusConnect 2026 Ticket #RSVP123";
    const bits = stringToBits(original);
    expect(bits.length).toBe(original.length * 8);

    const reconstructed = bitsToString(bits);
    expect(reconstructed).toBe(original);
  });

  it("embeds and extracts payload data into ImageData LSB correctly", () => {
    const width = 100;
    const height = 100;
    const buffer = new Uint8ClampedArray(width * height * 4);

    // Fill canvas image data with white background (255, 255, 255, 255)
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 255;
      buffer[i + 1] = 255;
      buffer[i + 2] = 255;
      buffer[i + 3] = 255;
    }

    const imageData = createImageDataContainer(width, height, buffer);
    const rawPayload = JSON.stringify({ rsvpId: "RSVP-9988", timestamp: 1700000000 });

    const modifiedImageData = embedLSBData(imageData, rawPayload);
    const extractedPayload = extractLSBData(modifiedImageData);

    expect(extractedPayload).toBe(rawPayload);
  });

  it("modifies pixel color values by at most 1 unit (LSB only)", () => {
    const width = 20;
    const height = 20;
    const originalBuffer = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < originalBuffer.length; i++) {
      originalBuffer[i] = 200;
    }

    const imageData = createImageDataContainer(
      width,
      height,
      new Uint8ClampedArray(originalBuffer),
    );
    const payload = "Secret Cryptographic Signature Data";

    const stegoImageData = embedLSBData(imageData, payload);
    const modifiedBuffer = stegoImageData.data;

    for (let i = 0; i < modifiedBuffer.length; i++) {
      const diff = Math.abs(modifiedBuffer[i] - originalBuffer[i]);
      expect(diff).toBeLessThanOrEqual(1);
    }
  });

  it("returns null when extracting LSB from clean or non-steganographic ImageData", () => {
    const buffer = new Uint8ClampedArray(100 * 100 * 4);
    buffer.fill(128);

    const cleanImageData = createImageDataContainer(100, 100, buffer);
    const result = extractLSBData(cleanImageData);

    expect(result).toBeNull();
  });
});

describe("steganography Ed25519 / HMAC signature module", () => {
  beforeEach(() => {
    // Only fake the clock/timer APIs — leave Node internals alone so async
    // Web Crypto calls (crypto.subtle.digest) keep working normally.
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates and verifies valid ticket signatures", async () => {
    const rsvpId = "RSVP-ABC-123";
    const timestamp = Date.now();

    const signedPayload = await signTicketPayload(rsvpId, timestamp);
    const result = await verifyTicketPayload(signedPayload);

    expect(result.valid).toBe(true);
    expect(result.rsvpId).toBe(rsvpId);
    expect(result.timestamp).toBe(timestamp);
  });

  it("rejects tampered ticket payloads with invalid signatures", async () => {
    const rsvpId = "RSVP-GENUINE";
    const signedPayload = await signTicketPayload(rsvpId);

    // Tamper with the RSVP ID
    const tamperedPayload = {
      ...signedPayload,
      rsvpId: "RSVP-FAKE-ATTEMPT",
    };

    const result = await verifyTicketPayload(tamperedPayload);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("signature verification failed");
  });

  it("stays valid up to 23h59m and expires the instant it crosses the 24h boundary", async () => {
    const rsvpId = "RSVP-EXPIRED";
    const maxAgeMs = 24 * 60 * 60 * 1000;

    // Generate the ticket "now" (2024-01-01T12:00:00Z, from the fake clock above).
    const signedPayload = await signTicketPayload(rsvpId);

    // Time-travel 23 hours and 59 minutes forward — should still be valid.
    vi.advanceTimersByTime(23 * 60 * 60 * 1000 + 59 * 60 * 1000);
    const stillValid = await verifyTicketPayload(signedPayload, maxAgeMs);
    expect(stillValid.valid).toBe(true);

    // Time-travel 2 more minutes forward — now past the 24-hour mark.
    vi.advanceTimersByTime(2 * 60 * 1000);
    const nowExpired = await verifyTicketPayload(signedPayload, maxAgeMs);
    expect(nowExpired.valid).toBe(false);
    expect(nowExpired.reason).toContain("expired");
  });
  it("computes SHA-256 hex hashes reproducibly", async () => {
    const hash1 = await sha256Hex("CampusConnect");
    const hash2 = await sha256Hex("CampusConnect");

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });
});
