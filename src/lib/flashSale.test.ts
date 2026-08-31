import { describe, expect, it } from "vitest";

import {
  formatFlashSaleCountdown,
  getRemainingSeconds,
  isFlashSaleRealtimePayload,
} from "./flashSale";

describe("flash sale helpers", () => {
  it("formats countdowns as an accessible fixed-width clock", () => {
    expect(formatFlashSaleCountdown(0)).toBe("00:00:00");
    expect(formatFlashSaleCountdown(3_661)).toBe("01:01:01");
    expect(formatFlashSaleCountdown(-10)).toBe("00:00:00");
  });

  it("rounds remaining time up while never returning negative seconds", () => {
    const expiresAt = new Date(10_500).toISOString();
    expect(getRemainingSeconds(expiresAt, 10_000)).toBe(1);
    expect(getRemainingSeconds(expiresAt, 11_000)).toBe(0);
    expect(getRemainingSeconds("not-a-date", 10_000)).toBe(0);
  });

  it("accepts only realtime payloads with opaque event and sale IDs", () => {
    expect(isFlashSaleRealtimePayload({ eventId: "event-1", saleId: "sale-1" })).toBe(true);
    expect(isFlashSaleRealtimePayload({ eventId: "event-1" })).toBe(false);
    expect(isFlashSaleRealtimePayload({ eventId: 1, saleId: "sale-1" })).toBe(false);
  });
});
