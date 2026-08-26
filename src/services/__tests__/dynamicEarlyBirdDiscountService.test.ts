import { describe, it, expect } from "vitest";
import {
  computeEarlyBirdMetrics,
  generatePricingRecommendations,
  simulatePricingScenario,
  getMockEarlyBirdData,
} from "../dynamicEarlyBirdDiscountService";
import type { TicketTier, SalesVelocityPoint } from "@/types/dynamicEarlyBirdDiscount";

describe("Dynamic Early Bird Discount Analytics Service", () => {
  const sampleTiers: TicketTier[] = [
    {
      id: "eb-1",
      name: "Early Bird Tier",
      originalPrice: 20,
      currentPrice: 15,
      quota: 100,
      soldCount: 90,
      releaseDate: "2026-08-01T00:00:00Z",
      endDate: "2026-08-15T23:59:59Z",
      isActive: true,
    },
    {
      id: "reg-2",
      name: "Regular Tier",
      originalPrice: 25,
      currentPrice: 25,
      quota: 150,
      soldCount: 40,
      releaseDate: "2026-08-16T00:00:00Z",
      endDate: "2026-08-28T23:59:59Z",
      isActive: true,
    },
  ];

  const sampleTimeSeries: SalesVelocityPoint[] = [
    { timestamp: "2026-08-01T08:00:00Z", cumulativeSales: 20, velocityPerHour: 10, revenueDelta: 300, tierId: "eb-1" },
    { timestamp: "2026-08-01T12:00:00Z", cumulativeSales: 55, velocityPerHour: 15, revenueDelta: 525, tierId: "eb-1" },
    { timestamp: "2026-08-01T18:00:00Z", cumulativeSales: 90, velocityPerHour: 12, revenueDelta: 525, tierId: "eb-1" },
  ];

  describe("computeEarlyBirdMetrics", () => {
    it("computes absorption rate, peak velocity, and time to 50% sold accurately", () => {
      const metrics = computeEarlyBirdMetrics(sampleTiers[0], sampleTimeSeries);

      expect(metrics.tierId).toBe("eb-1");
      expect(metrics.absorptionRate).toBe(0.9); // 90/100
      expect(metrics.peakVelocityPerHour).toBe(15);
      expect(metrics.revenueGenerated).toBe(1350); // 90 * 15
      expect(metrics.timeTo50PercentSoldHours).toBe(4); // 12h - 8h = 4h
    });

    it("handles zero sales gracefully without division by zero errors", () => {
      const emptyTier: TicketTier = {
        id: "eb-zero",
        name: "Early Bird Tier",
        originalPrice: 20,
        currentPrice: 15,
        quota: 100,
        soldCount: 0,
        releaseDate: "2026-08-01T00:00:00Z",
        endDate: "2026-08-15T23:59:59Z",
        isActive: true,
      };

      const metrics = computeEarlyBirdMetrics(emptyTier, []);

      expect(metrics.absorptionRate).toBe(0);
      expect(metrics.revenueGenerated).toBe(0);
      expect(metrics.velocityTrend).toBe("sluggish");
      expect(metrics.timeTo50PercentSoldHours).toBeNull();
    });

    it("identifies sold_out status when soldCount >= quota", () => {
      const soldOutTier: TicketTier = {
        ...sampleTiers[0],
        soldCount: 100,
      };

      const metrics = computeEarlyBirdMetrics(soldOutTier, sampleTimeSeries);
      expect(metrics.absorptionRate).toBe(1.0);
      expect(metrics.velocityTrend).toBe("sold_out");
    });
  });

  describe("generatePricingRecommendations", () => {
    it("triggers price_increase recommendation when early bird absorption is high (>= 80%)", () => {
      const metrics = computeEarlyBirdMetrics(sampleTiers[0], sampleTimeSeries);
      const recommendations = generatePricingRecommendations(sampleTiers, metrics, 300);

      const priceBumpRec = recommendations.find((r) => r.type === "price_increase");
      expect(priceBumpRec).toBeDefined();
      expect(priceBumpRec?.confidenceScore).toBeGreaterThanOrEqual(80);
      expect(priceBumpRec?.actionableParams.suggestedPrice).toBe(29); // 25 * 1.15 = 28.75 -> 29
    });

    it("triggers extend_deadline and flash_promo recommendations when absorption is sluggish", () => {
      const sluggishTier: TicketTier = {
        id: "eb-sluggish",
        name: "Early Bird Tier",
        originalPrice: 20,
        currentPrice: 15,
        quota: 100,
        soldCount: 15,
        releaseDate: "2026-08-01T00:00:00Z",
        endDate: "2026-08-15T23:59:59Z",
        isActive: true,
      };

      const sluggishTimeSeries: SalesVelocityPoint[] = [
        { timestamp: "2026-08-01T08:00:00Z", cumulativeSales: 5, velocityPerHour: 1, revenueDelta: 75, tierId: "eb-sluggish" },
        { timestamp: "2026-08-02T08:00:00Z", cumulativeSales: 15, velocityPerHour: 1, revenueDelta: 150, tierId: "eb-sluggish" },
      ];

      const metrics = computeEarlyBirdMetrics(sluggishTier, sluggishTimeSeries);
      const recommendations = generatePricingRecommendations([sluggishTier, sampleTiers[1]], metrics, 300);

      const extendDeadlineRec = recommendations.find((r) => r.type === "extend_deadline");
      expect(extendDeadlineRec).toBeDefined();
      expect(extendDeadlineRec?.actionableParams.suggestedDeadlineExtensionHours).toBe(48);

      const flashPromoRec = recommendations.find((r) => r.type === "promotional_flash_sale");
      expect(flashPromoRec).toBeDefined();
    });
  });

  describe("simulatePricingScenario", () => {
    it("generates 6 elasticity steps from -20% to +30%", () => {
      const scenarios = simulatePricingScenario(sampleTiers, "eb-1", 0, 0, 0);

      expect(scenarios.length).toBe(6);
      expect(scenarios[0].priceDeltaPct).toBe(-20);
      expect(scenarios[scenarios.length - 1].priceDeltaPct).toBe(30);

      // Verifies price increases result in simulated price changes
      expect(scenarios[0].simulatedPrice).toBe(16); // 20 * 0.8
      expect(scenarios[scenarios.length - 1].simulatedPrice).toBe(26); // 20 * 1.3
    });
  });

  describe("getMockEarlyBirdData", () => {
    it("returns complete baseline data for event fallback", () => {
      const data = getMockEarlyBirdData("evt-test-123");

      expect(data.eventId).toBe("evt-test-123");
      expect(data.tiers.length).toBeGreaterThanOrEqual(2);
      expect(data.recommendations.length).toBeGreaterThan(0);
      expect(data.earlyBirdMetrics).toBeDefined();
    });
  });
});
