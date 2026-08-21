import { describe, it, expect } from "vitest";
import {
  generateDynamicQrTicketToken,
  validateDynamicQrTicketToken,
  calculateRefreshCountdown,
  DYNAMIC_QR_REFRESH_INTERVAL_MS,
  DYNAMIC_QR_EXPIRATION_MS,
} from "./dynamicQrTicket";

describe("Dynamic QR Code Refresh - Anti-Screenshot Engine (#3189)", () => {
  const secretKey = "test_ticket_secret";
  const nowMs = 1750000000000;

  describe("Dynamic QR Ticket Generation & Validation", () => {
    it("generates and verifies valid dynamic QR ticket tokens", () => {
      const token = generateDynamicQrTicketToken("rsvp_100", "usr_50", "evt_10", secretKey, nowMs);
      const res = validateDynamicQrTicketToken(token, secretKey, nowMs);

      expect(res.valid).toBe(true);
      expect(res.payload?.rsvpId).toBe("rsvp_100");
      expect(res.payload?.userId).toBe("usr_50");
      expect(res.payload?.eventId).toBe("evt_10");
    });

    it("rejects expired screenshot tokens with 'Screenshot Detected' alert", () => {
      const pastTime = nowMs - DYNAMIC_QR_EXPIRATION_MS - 30000; // Generated 1 min ago
      const screenshotToken = generateDynamicQrTicketToken(
        "rsvp_100",
        "usr_50",
        "evt_10",
        secretKey,
        pastTime,
      );

      const res = validateDynamicQrTicketToken(screenshotToken, secretKey, nowMs);

      expect(res.valid).toBe(false);
      expect(res.isExpired).toBe(true);
      expect(res.error).toContain("Screenshot Detected");
    });

    it("rejects tampered tokens with invalid cryptographic signatures", () => {
      const token = generateDynamicQrTicketToken("rsvp_100", "usr_50", "evt_10", secretKey, nowMs);
      const tamperedToken = token.replace("rsvp_100", "rsvp_attacker");

      const res = validateDynamicQrTicketToken(tamperedToken, secretKey, nowMs);

      expect(res.valid).toBe(false);
      expect(res.error).toContain("signature");
    });

    it("flags offline fallback tickets with bouncer warning alert", () => {
      const offlineToken = generateDynamicQrTicketToken(
        "rsvp_100",
        "usr_50",
        "evt_10",
        secretKey,
        nowMs,
        true, // isOffline = true
      );

      const res = validateDynamicQrTicketToken(offlineToken, secretKey, nowMs);

      expect(res.valid).toBe(true);
      expect(res.isOfflineFallback).toBe(true);
      expect(res.warning).toBe("Offline Ticket - Verify ID visually");
    });
  });

  describe("UI Progress Bar Refresh Countdown", () => {
    it("calculates seconds remaining until next 15-second refresh", () => {
      const lastRefresh = nowMs - 3000; // 3s ago
      const countdown = calculateRefreshCountdown(
        lastRefresh,
        DYNAMIC_QR_REFRESH_INTERVAL_MS,
        nowMs,
      );

      expect(countdown.secondsRemaining).toBe(12);
      expect(countdown.label).toBe("Refreshes in 12s");
    });
  });
});
