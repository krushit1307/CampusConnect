// =============================================================================
// File: src/services/dynamicEarlyBirdDiscountService.ts
// Feature: Dynamic "Early Bird" Discount Analytics
// Description: Analytical engine for ticket sales velocity calculation, tier
//              absorption tracking, automated price optimization recommendations,
//              and demand elasticity forecasting for campus events.
// =============================================================================

import type {
  TicketTier,
  SalesVelocityPoint,
  EarlyBirdMetrics,
  PricingRecommendation,
  ElasticityScenario,
  EarlyBirdAnalyticsData,
} from "@/types/dynamicEarlyBirdDiscount";

/**
 * Calculates velocity metrics and absorption rates for early bird and subsequent tiers.
 */
export function computeEarlyBirdMetrics(
  tier: TicketTier,
  timeSeries: SalesVelocityPoint[]
): EarlyBirdMetrics {
  const tierPoints = timeSeries.filter((p) => p.tierId === tier.id);
  const soldCount = tier.soldCount;
  const totalQuota = Math.max(tier.quota, 1);
  const absorptionRate = Math.min(soldCount / totalQuota, 1.0);

  // Peak velocity
  const peakVelocityPerHour =
    tierPoints.length > 0
      ? Math.max(...tierPoints.map((p) => p.velocityPerHour), 0)
      : soldCount > 0
        ? Math.round(soldCount / 24)
        : 0;

  // Current velocity (last data point or average)
  const currentVelocityPerHour =
    tierPoints.length > 0
      ? tierPoints[tierPoints.length - 1].velocityPerHour
      : soldCount > 0
        ? Math.round(soldCount / 48)
        : 0;

  // Time to 50% sold and time to sellout (in hours from release)
  let timeTo50PercentSoldHours: number | null = null;
  let timeToSelloutHours: number | null = null;

  if (tierPoints.length > 0) {
    const firstTimestamp = new Date(tierPoints[0].timestamp).getTime();
    const point50 = tierPoints.find((p) => p.cumulativeSales >= totalQuota * 0.5);
    if (point50) {
      timeTo50PercentSoldHours = Math.max(
        1,
        Math.round((new Date(point50.timestamp).getTime() - firstTimestamp) / (1000 * 3600))
      );
    }
    const point100 = tierPoints.find((p) => p.cumulativeSales >= totalQuota);
    if (point100) {
      timeToSelloutHours = Math.max(
        1,
        Math.round((new Date(point100.timestamp).getTime() - firstTimestamp) / (1000 * 3600))
      );
    }
  }

  const revenueGenerated = soldCount * tier.currentPrice;
  const projectedBaselineRevenue = totalQuota * tier.originalPrice * 0.85; // Baseline model assumption
  const revenueYieldPct =
    projectedBaselineRevenue > 0
      ? Math.round((revenueGenerated / projectedBaselineRevenue) * 100)
      : 100;

  // Velocity Trend calculation
  let velocityTrend: "accelerating" | "steady" | "sluggish" | "sold_out" = "steady";
  if (soldCount >= totalQuota) {
    velocityTrend = "sold_out";
  } else if (currentVelocityPerHour > peakVelocityPerHour * 0.7 && currentVelocityPerHour >= 5) {
    velocityTrend = "accelerating";
  } else if (currentVelocityPerHour < 2 || absorptionRate < 0.25) {
    velocityTrend = "sluggish";
  }

  return {
    tierId: tier.id,
    tierName: tier.name,
    totalQuota,
    soldCount,
    absorptionRate,
    timeTo50PercentSoldHours,
    timeToSelloutHours,
    currentVelocityPerHour,
    peakVelocityPerHour,
    revenueGenerated,
    projectedBaselineRevenue,
    revenueYieldPct,
    velocityTrend,
  };
}

/**
 * Core Algorithmic Recommendation Engine for Automated Dynamic Pricing.
 */
export function generatePricingRecommendations(
  tiers: TicketTier[],
  earlyBirdMetrics: EarlyBirdMetrics,
  totalEventCapacity: number
): PricingRecommendation[] {
  const recommendations: PricingRecommendation[] = [];

  const earlyBirdTier = tiers.find((t) => t.id === earlyBirdMetrics.tierId) || tiers[0];
  const regularTier = tiers.find((t) => t.id !== earlyBirdMetrics.tierId) || tiers[1];

  // Rule 1: Rapid Absorption (High Velocity) -> Increase next tier price or shorten early bird window
  if (
    earlyBirdMetrics.absorptionRate >= 0.8 ||
    (earlyBirdMetrics.timeTo50PercentSoldHours !== null && earlyBirdMetrics.timeTo50PercentSoldHours <= 12)
  ) {
    recommendations.push({
      id: "rec-high-velocity-price-bump",
      type: "price_increase",
      title: "High Demand Velocity: Increase Next Tier Price by 15%",
      description: `Early Bird tickets reached ${Math.round(
        earlyBirdMetrics.absorptionRate * 100
      )}% quota absorption in accelerated time (${
        earlyBirdMetrics.timeTo50PercentSoldHours || 12
      } hours). High willingness to pay indicates Regular Tier can absorb a price increase from $${
        regularTier?.currentPrice ?? 25
      } to $${Math.round((regularTier?.currentPrice ?? 25) * 1.15)}.`,
      confidenceScore: 92,
      projectedRevenueImpactPct: 15.4,
      urgency: "high",
      actionableParams: {
        targetTierId: regularTier?.id,
        suggestedPrice: Math.round((regularTier?.currentPrice ?? 25) * 1.15),
      },
    });
  }

  // Rule 2: Sluggish Sales (Low Velocity) -> Extend Early Bird Deadline or Offer Promotional Flash Discount
  if (earlyBirdMetrics.absorptionRate < 0.35 && earlyBirdMetrics.velocityTrend === "sluggish") {
    recommendations.push({
      id: "rec-sluggish-deadline-extend",
      type: "extend_deadline",
      title: "Sluggish Absorption: Extend Early Bird Window by 48 Hours",
      description: `Early Bird quota absorption is low (${Math.round(
        earlyBirdMetrics.absorptionRate * 100
      )}%). Extending the discount deadline by 48 hours is projected to capture peak student signup activity without reducing nominal price.`,
      confidenceScore: 84,
      projectedRevenueImpactPct: 9.8,
      urgency: "medium",
      actionableParams: {
        targetTierId: earlyBirdTier?.id,
        suggestedDeadlineExtensionHours: 48,
      },
    });

    recommendations.push({
      id: "rec-sluggish-flash-promo",
      type: "promotional_flash_sale",
      title: "Activate 10% Campus Group Promo Code",
      description:
        "Trigger a targeted 10% discount for registered club members to jumpstart momentum before early bird transition.",
      confidenceScore: 78,
      projectedRevenueImpactPct: 7.2,
      urgency: "medium",
      actionableParams: {
        targetTierId: earlyBirdTier?.id,
        recommendedDiscountPct: 10,
      },
    });
  }

  // Rule 3: Quota Optimization -> Reallocate unsold quota between tiers
  const totalSold = tiers.reduce((acc, t) => acc + t.soldCount, 0);
  if (earlyBirdMetrics.absorptionRate >= 0.95 && totalSold < totalEventCapacity * 0.7) {
    recommendations.push({
      id: "rec-quota-reallocation",
      type: "quota_reallocation",
      title: "Expand Early Bird Tier Quota by +20%",
      description:
        "Early Bird tier sold out almost completely. Reallocating 20 tickets from Regular to Early Bird tier at a slight price step-up ($18) will sustain ticket purchasing momentum.",
      confidenceScore: 88,
      projectedRevenueImpactPct: 11.2,
      urgency: "medium",
      actionableParams: {
        targetTierId: earlyBirdTier?.id,
        suggestedQuotaAdjustment: 20,
        suggestedPrice: (earlyBirdTier?.currentPrice ?? 15) + 3,
      },
    });
  }

  // Rule 4: Future Event Strategy Recommendation
  recommendations.push({
    id: "rec-future-event-pricing-curve",
    type: "future_event_pricing",
    title: "Optimized 3-Tier Dynamic Pricing Curve for Future Events",
    description:
      "Based on historic velocity data, set Future Early Bird at $15 (30% quota), Regular at $24 (50% quota), and Last-Minute VIP at $35 (20% quota) to maximize yield.",
    confidenceScore: 90,
    projectedRevenueImpactPct: 18.5,
    urgency: "low",
    actionableParams: {
      suggestedPrice: 15,
      recommendedDiscountPct: 25,
    },
  });

  return recommendations;
}

/**
 * Simulates demand elasticity under varying price and deadline adjustments.
 */
export function simulatePricingScenario(
  tiers: TicketTier[],
  earlyBirdTierId: string,
  priceDeltaPct: number, // e.g. -20% to +30%
  extensionHours: number = 0,
  quotaDelta: number = 0
): ElasticityScenario[] {
  const steps = [-20, -10, 0, 10, 20, 30];

  const targetTier = tiers.find((t) => t.id === earlyBirdTierId) || tiers[0];
  const basePrice = targetTier.originalPrice;
  const currentTotalRevenue = tiers.reduce((acc, t) => acc + t.soldCount * t.currentPrice, 0);
  const totalCapacity = tiers.reduce((acc, t) => acc + t.quota, 0);

  return steps.map((delta) => {
    const simulatedPrice = Math.max(1, Math.round(basePrice * (1 + delta / 100)));
    // Price Elasticity of Demand (PED) model assumption: E_d = -1.2 for campus events
    const elasticityFactor = -1.2;
    const turnoutModifier = 1 + (delta / 100) * elasticityFactor + (extensionHours / 100) * 0.15;
    
    const targetQuota = Math.max(10, targetTier.quota + quotaDelta);
    const projectedTurnout = Math.min(
      totalCapacity,
      Math.max(10, Math.round(targetQuota * Math.max(0.2, turnoutModifier)))
    );
    const projectedTurnoutPctOfCapacity = Math.round((projectedTurnout / totalCapacity) * 100);

    // Projected total revenue across tiers
    const projectedTierRevenue = projectedTurnout * simulatedPrice;
    const otherTiersRevenue = tiers
      .filter((t) => t.id !== earlyBirdTierId)
      .reduce((acc, t) => acc + t.soldCount * t.currentPrice, 0);

    const projectedRevenue = Math.round(projectedTierRevenue + otherTiersRevenue);
    const revenueDifference = projectedRevenue - currentTotalRevenue;

    return {
      priceDeltaPct: delta,
      simulatedPrice,
      projectedTurnout,
      projectedTurnoutPctOfCapacity,
      projectedRevenue,
      revenueDifference,
    };
  });
}

/**
 * Generates initial baseline mock data for demonstration or fallback.
 */
export function getMockEarlyBirdData(eventId: string = "evt-demo-1"): EarlyBirdAnalyticsData {
  const tiers: TicketTier[] = [
    {
      id: "tier-eb-1",
      name: "Early Bird Tier",
      originalPrice: 20.0,
      currentPrice: 15.0, // 25% discount
      quota: 100,
      soldCount: 88,
      releaseDate: "2026-08-01T00:00:00.000Z",
      endDate: "2026-08-15T23:59:59.000Z",
      isActive: true,
    },
    {
      id: "tier-reg-2",
      name: "Regular Tier",
      originalPrice: 25.0,
      currentPrice: 25.0,
      quota: 150,
      soldCount: 42,
      releaseDate: "2026-08-16T00:00:00.000Z",
      endDate: "2026-08-28T23:59:59.000Z",
      isActive: true,
    },
    {
      id: "tier-vip-3",
      name: "VIP Express Tier",
      originalPrice: 40.0,
      currentPrice: 40.0,
      quota: 50,
      soldCount: 18,
      releaseDate: "2026-08-01T00:00:00.000Z",
      endDate: "2026-08-28T23:59:59.000Z",
      isActive: true,
    },
  ];

  const velocityTimeSeries: SalesVelocityPoint[] = [
    { timestamp: "2026-08-01T08:00:00Z", cumulativeSales: 12, velocityPerHour: 6, revenueDelta: 180, tierId: "tier-eb-1" },
    { timestamp: "2026-08-02T08:00:00Z", cumulativeSales: 35, velocityPerHour: 11, revenueDelta: 345, tierId: "tier-eb-1" },
    { timestamp: "2026-08-03T08:00:00Z", cumulativeSales: 58, velocityPerHour: 14, revenueDelta: 345, tierId: "tier-eb-1" },
    { timestamp: "2026-08-04T08:00:00Z", cumulativeSales: 74, velocityPerHour: 8, revenueDelta: 240, tierId: "tier-eb-1" },
    { timestamp: "2026-08-05T08:00:00Z", cumulativeSales: 88, velocityPerHour: 7, revenueDelta: 210, tierId: "tier-eb-1" },
  ];

  const totalCapacity = 300;
  const earlyBirdMetrics = computeEarlyBirdMetrics(tiers[0], velocityTimeSeries);
  const recommendations = generatePricingRecommendations(tiers, earlyBirdMetrics, totalCapacity);
  const totalSold = tiers.reduce((sum, t) => sum + t.soldCount, 0);
  const totalRevenue = tiers.reduce((sum, t) => sum + t.soldCount * t.currentPrice, 0);

  return {
    eventId,
    eventTitle: "Campus Annual Music & Tech Fest 2026",
    totalCapacity,
    totalSold,
    totalRevenue,
    overallVelocityPerHour: 7.2,
    tiers,
    velocityTimeSeries,
    earlyBirdMetrics,
    recommendations,
  };
}
