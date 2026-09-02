import { describe, it, expect } from "vitest";
import {
  calculateSurgeMultiplier,
  evaluateEventSurgePricing,
  EventDemandMetrics,
} from "./flashCrowdSurgePricing";

describe("Build Real-Time Dynamic Pricing Flash Crowd Surge Logic Suite (#4818)", () => {
  const baseMetrics: EventDemandMetrics = {
    eventId: "evt_drake_campus_surprise",
    basePriceCents: 1000, // $10.00 base ticket
    remainingTickets: 100,
    activeCheckoutViewers: 50, // 50 / 100 = 0.5 ratio -> Normal
    surgeEnabled: true,
  };

  it("maintains base price when viewer to ticket inventory ratio is below 5.0", () => {
    const result = evaluateEventSurgePricing(baseMetrics);

    expect(result.demandRatio).toBe(0.5);
    expect(result.isSurgeActive).toBe(false);
    expect(result.surgeMultiplier).toBe(1.0);
    expect(result.finalPriceCents).toBe(1000);
    expect(result.warningNotice).toBeNull();
  });

  it("triggers 1.5x surge pricing when demand ratio reaches 5.0 threshold", () => {
    const surge5xMetrics: EventDemandMetrics = {
      ...baseMetrics,
      activeCheckoutViewers: 500, // 500 / 100 = 5.0 ratio
    };

    const result = evaluateEventSurgePricing(surge5xMetrics);

    expect(result.demandRatio).toBe(5.0);
    expect(result.isSurgeActive).toBe(true);
    expect(result.surgeMultiplier).toBe(1.5);
    expect(result.finalPriceCents).toBe(1500); // $15.00
    expect(result.warningNotice).toBe(
      "SURGE PRICING ACTIVE: Due to extreme demand, ticket prices have temporarily increased.",
    );
  });

  it("escalates to 2.0x surge pricing multiplier during viral traffic spikes (e.g. 5000 viewers / 100 tickets)", () => {
    const viralMetrics: EventDemandMetrics = {
      ...baseMetrics,
      activeCheckoutViewers: 5000, // 5000 / 100 = 50.0 ratio >= 20.0
    };

    const result = evaluateEventSurgePricing(viralMetrics);

    expect(result.demandRatio).toBe(50.0);
    expect(result.isSurgeActive).toBe(true);
    expect(result.surgeMultiplier).toBe(2.0);
    expect(result.finalPriceCents).toBe(2000); // $20.00 ($10 base * 2.0)
  });

  it("automatically reverts price when active viewers drop back to normal", () => {
    const revertedMetrics: EventDemandMetrics = {
      ...baseMetrics,
      activeCheckoutViewers: 40, // Drops back to ratio 0.4
    };

    const result = evaluateEventSurgePricing(revertedMetrics);

    expect(result.isSurgeActive).toBe(false);
    expect(result.surgeMultiplier).toBe(1.0);
    expect(result.finalPriceCents).toBe(1000);
    expect(result.warningNotice).toBeNull();
  });
});
