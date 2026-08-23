// =============================================================================
// File: src/types/dynamicPricingFlashSale.ts
// Issue: #4292 - Build a 'Real-Time "Dynamic Pricing" Flash Sale Engine'
// Description: Type definitions for real-time Stripe dynamic pricing mutations,
//              flash sale campaigns, countdown timers, and marketing push blasts.
// =============================================================================

export type FlashSaleStatus =
  | "draft"
  | "active"
  | "paused"
  | "expired"
  | "reverted"
  | "sold_out";

export type TargetAudienceSegment =
  | "waitlist_only"
  | "club_followers"
  | "past_attendees"
  | "campus_wide_public";

export interface TicketTierPricing {
  id: string; // e.g. "tier-vip-01"
  name: string; // e.g. "General Admission Tier 1"
  originalPriceUsd: number; // e.g. 40.00
  originalStripePriceId: string; // e.g. "price_1Nxxxxxxxxxxxx"
  totalAllocatedInventory: number;
  currentlySold: number;
  availableUnsold: number;
}

export interface FlashSaleCampaign {
  id: string; // e.g. "sale-gala-50off"
  eventId: string;
  eventTitle: string;
  clubId?: string;
  clubName?: string;
  ticketTierId: string;
  ticketTierName: string;
  originalPriceUsd: number;
  discountPercentage: number; // e.g. 50%
  discountedPriceUsd: number; // e.g. 20.00
  originalStripePriceId: string;
  activeDynamicStripePriceId: string;
  totalFlashSaleTicketsCap: number; // e.g. 50 tickets
  ticketsSoldDuringSale: number;
  grossRevenueUsd: number;
  durationMinutes: number; // e.g. 60 minutes
  startsAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  status: FlashSaleStatus;
  targetAudience: TargetAudienceSegment;
  customMarketingHeadline?: string;
  marketingBlastSent: boolean;
  marketingRecipientsCount: number;
  autoRevertJobScheduled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FlashSaleLiquidationMetrics {
  totalOriginalUnsoldValueUsd: number;
  realizedFlashRevenueUsd: number;
  ticketsSold: number;
  remainingFlashInventory: number;
  liquidationVelocityPerMinute: number;
  conversionRatePercent: number;
  priceElasticityCoefficient: number; // % change in qty / % change in price
  projectedRevenueLossWithoutSaleUsd: number;
}

export interface FlashSaleOrderPurchase {
  id: string;
  campaignId: string;
  buyerName: string;
  buyerEmail: string;
  ticketCount: number;
  unitPriceUsd: number;
  totalPaidUsd: number;
  purchasedAt: string;
  stripePaymentIntentId: string;
}

export interface FlashSaleCreatePayload {
  eventId: string;
  ticketTierId: string;
  discountPercentage: number;
  durationMinutes: number;
  ticketCap: number;
  targetAudience: TargetAudienceSegment;
  customHeadline?: string;
}
