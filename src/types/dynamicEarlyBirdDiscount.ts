// =============================================================================
// File: src/types/dynamicEarlyBirdDiscount.ts
// Feature: Dynamic "Early Bird" Discount Analytics
// Description: Type definitions for ticket tier sales velocity, early bird
//              absorption rates, automated pricing recommendations, and
//              demand elasticity simulations.
// =============================================================================

export interface TicketTier {
  id: string;
  name: string; // e.g. "Early Bird", "Tier 1 Regular", "VIP Access"
  originalPrice: number;
  currentPrice: number;
  quota: number;
  soldCount: number;
  releaseDate: string; // ISO String
  endDate: string; // ISO String
  isActive: boolean;
}

export interface SalesVelocityPoint {
  timestamp: string; // ISO String
  cumulativeSales: number;
  velocityPerHour: number; // tickets sold per hour
  revenueDelta: number;
  tierId: string;
}

export interface EarlyBirdMetrics {
  tierId: string;
  tierName: string;
  totalQuota: number;
  soldCount: number;
  absorptionRate: number; // 0.0 - 1.0 (percentage of quota sold)
  timeTo50PercentSoldHours: number | null;
  timeToSelloutHours: number | null;
  currentVelocityPerHour: number;
  peakVelocityPerHour: number;
  revenueGenerated: number;
  projectedBaselineRevenue: number;
  revenueYieldPct: number; // Actual vs Projected percentage
  velocityTrend: "accelerating" | "steady" | "sluggish" | "sold_out";
}

export type RecommendationType =
  | "price_increase"
  | "extend_deadline"
  | "quota_reallocation"
  | "future_event_pricing"
  | "promotional_flash_sale";

export interface PricingRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  confidenceScore: number; // 0 - 100%
  projectedRevenueImpactPct: number; // e.g. +14.5%
  urgency: "high" | "medium" | "low";
  actionableParams: {
    targetTierId?: string;
    suggestedPrice?: number;
    suggestedDeadlineExtensionHours?: number;
    suggestedQuotaAdjustment?: number;
    recommendedDiscountPct?: number;
  };
}

export interface ElasticityScenario {
  priceDeltaPct: number;
  simulatedPrice: number;
  projectedTurnout: number;
  projectedTurnoutPctOfCapacity: number;
  projectedRevenue: number;
  revenueDifference: number;
}

export interface EarlyBirdAnalyticsData {
  eventId: string;
  eventTitle: string;
  totalCapacity: number;
  totalSold: number;
  totalRevenue: number;
  overallVelocityPerHour: number;
  tiers: TicketTier[];
  velocityTimeSeries: SalesVelocityPoint[];
  earlyBirdMetrics: EarlyBirdMetrics;
  recommendations: PricingRecommendation[];
}
