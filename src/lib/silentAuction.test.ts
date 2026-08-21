import { describe, it, expect } from "vitest";
import {
  validateBidAmount,
  calculateAntiSnipingExtension,
  formatAuctionTimeRemaining,
  ANTI_SNIPING_THRESHOLD_MS,
  ANTI_SNIPING_EXTENSION_MS,
} from "./silentAuction";

describe("Silent Auction Bidding Module - Senior Engine (#3021)", () => {
  describe("Senior Bid Validation Engine", () => {
    it("rejects bids lower than or equal to current highest bid", () => {
      const currentHighest = 50;
      const startingBid = 20;

      expect(validateBidAmount(50, currentHighest, startingBid).valid).toBe(false);
      expect(validateBidAmount(45, currentHighest, startingBid).valid).toBe(false);
    });

    it("rejects bids lower than starting bid", () => {
      expect(validateBidAmount(10, 0, 25).valid).toBe(false);
    });

    it("accepts valid higher bids meeting requirements", () => {
      expect(validateBidAmount(60, 50, 20).valid).toBe(true);
      expect(validateBidAmount(100, 0, 50).valid).toBe(true);
    });
  });

  describe("Anti-Sniping 5-Minute Timer Extension", () => {
    it("extends end time by 5 minutes (300,000ms) for bids placed in final 2 minutes (120,000ms)", () => {
      const endTimeIso = "2026-08-15T22:00:00Z";
      const bidInFinalMinute = new Date("2026-08-15T21:59:30Z"); // 30s before end

      const result = calculateAntiSnipingExtension(endTimeIso, bidInFinalMinute);

      expect(result.shouldExtend).toBe(true);
      expect(result.newEndTime?.toISOString()).toBe("2026-08-15T22:04:30.000Z");
    });

    it("does not extend end time for bids placed well before final 2 minutes", () => {
      const endTimeIso = "2026-08-15T22:00:00Z";
      const earlyBid = new Date("2026-08-15T21:45:00Z"); // 15 minutes before end

      const result = calculateAntiSnipingExtension(endTimeIso, earlyBid);
      expect(result.shouldExtend).toBe(false);
    });

    it("enforces anti-sniping threshold constants (2-min threshold, 5-min extension)", () => {
      expect(ANTI_SNIPING_THRESHOLD_MS).toBe(120000);
      expect(ANTI_SNIPING_EXTENSION_MS).toBe(300000);
    });
  });

  describe("Auction Countdown Timer Formatting", () => {
    it("formats minutes and seconds remaining", () => {
      const endTimeIso = "2026-08-15T12:15:30Z";
      const now = new Date("2026-08-15T12:00:00Z");

      const timer = formatAuctionTimeRemaining(endTimeIso, now);

      expect(timer.isClosed).toBe(false);
      expect(timer.label).toBe("15m 30s remaining");
    });

    it("identifies closed auctions past end time", () => {
      const pastEndTimeIso = "2026-08-15T10:00:00Z";
      const now = new Date("2026-08-15T12:00:00Z");

      const timer = formatAuctionTimeRemaining(pastEndTimeIso, now);

      expect(timer.isClosed).toBe(true);
      expect(timer.label).toBe("Auction Closed");
    });
  });
});
