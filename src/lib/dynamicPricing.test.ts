import { describe, it, expect } from "vitest";
import {
  getActiveTicketPrice,
  formatEarlyBirdUrgency,
  getStripeCheckoutSessionDuration,
  type PriceScheduleItem,
} from "./dynamicPricing";

describe("Dynamic Early-Bird Pricing Engine (#3003)", () => {
  const schedule: PriceScheduleItem[] = [
    { price: 1000, endDate: "2026-11-01T00:00:00Z" }, // $10.00 until Nov 1
    { price: 1500, endDate: null }, // $15.00 regular
  ];

  it("returns early bird price ($10) before deadline", () => {
    const beforeDeadline = new Date("2026-10-25T12:00:00Z");
    const result = getActiveTicketPrice(schedule, 1500, beforeDeadline);

    expect(result.activePrice).toBe(1000);
    expect(result.isEarlyBird).toBe(true);
    expect(result.nextPrice).toBe(1500);
    expect(result.endsInSeconds).toBeGreaterThan(0);
  });

  it("reverts to regular price ($15) after early bird deadline passes", () => {
    const afterDeadline = new Date("2026-11-02T12:00:00Z");
    const result = getActiveTicketPrice(schedule, 1500, afterDeadline);

    expect(result.activePrice).toBe(1500);
    expect(result.isEarlyBird).toBe(false);
  });

  it("formats urgency banner message correctly", () => {
    const twoDaysBefore = new Date("2026-10-30T00:00:00Z");
    const urgency = formatEarlyBirdUrgency(schedule, 1500, twoDaysBefore);

    expect(urgency).toBe("Early Bird ($10) ends in 2 days! Regular price ($15).");
  });

  it("returns null urgency when early bird phase is over", () => {
    const afterDeadline = new Date("2026-11-02T00:00:00Z");
    const urgency = formatEarlyBirdUrgency(schedule, 1500, afterDeadline);

    expect(urgency).toBeNull();
  });

  it("enforces 15-minute Stripe Checkout session duration limit", () => {
    const duration = getStripeCheckoutSessionDuration();
    expect(duration).toBe(900); // 15 minutes = 900 seconds
  });
});
