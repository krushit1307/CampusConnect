import { describe, it, expect } from "vitest";
import {
  urlBase64ToUint8Array,
  arrayBufferToBase64,
  formatEventReminderPayload,
  isPushSupported,
} from "./webPush";

describe("Web Push Utilities (#2645)", () => {
  it("converts URL-safe Base64 VAPID key string to Uint8Array", () => {
    const vapidKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Skv6";
    const bytes = urlBase64ToUint8Array(vapidKey);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("converts ArrayBuffer to Base64 string", () => {
    const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer; // "Hello"
    const base64 = arrayBufferToBase64(buffer);

    expect(base64).toBe("SGVsbG8=");
  });

  it("formats structured event reminder push payload with deep-link URL", () => {
    const payload = formatEventReminderPayload("Annual Hackathon 2026", "evt_123", 60);

    expect(payload.title).toBe("Upcoming Event: Annual Hackathon 2026");
    expect(payload.body).toContain("starts in 60 minutes");
    expect(payload.data.url).toBe("/events/evt_123");
    expect(payload.data.eventId).toBe("evt_123");
    expect(payload.tag).toBe("event-reminder-evt_123");
  });

  it("checks browser web push support safely", () => {
    const supported = isPushSupported();
    expect(typeof supported).toBe("boolean");
  });
});
