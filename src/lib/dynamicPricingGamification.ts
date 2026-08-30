export type GamificationTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface StripeLineItem {
  price_data: {
    currency: string;
    product_data: {
      name: string;
      description?: string;
    };
    unit_amount: number; // in cents
  };
  quantity: number;
}

export interface DynamicCheckoutSessionPayload {
  userId: string;
  gamificationTier: GamificationTier;
  originalUnitAmountCents: number;
  discountedUnitAmountCents: number;
  discountPercentage: number;
  appliedBannerMessage: string | null;
  lineItems: StripeLineItem[];
}

export const TIER_DISCOUNT_RATES: Record<GamificationTier, number> = {
  Bronze: 0,
  Silver: 0.05, // 5%
  Gold: 0.15, // 15%
  Platinum: 0.2, // 20%
};

/**
 * Calculates the discounted unit amount in cents for a given tier.
 */
export function calculateTierDiscountedAmount(
  baseAmountCents: number,
  tier: GamificationTier,
): { discountedAmountCents: number; discountPercentage: number } {
  const discountRate = TIER_DISCOUNT_RATES[tier] || 0;
  const discountPercentage = Math.round(discountRate * 100);

  const discountedAmountCents = Math.round(baseAmountCents * (1 - discountRate));

  return {
    discountedAmountCents,
    discountPercentage,
  };
}

/**
 * Dynamically rewrites Stripe line_items unit_amount based on user gamification tier.
 */
export function buildDynamicStripeCheckoutPayload(
  userId: string,
  tier: GamificationTier,
  productName: string,
  originalUnitAmountCents: number,
  quantity = 1,
): DynamicCheckoutSessionPayload {
  const discountResult = calculateTierDiscountedAmount(originalUnitAmountCents, tier);

  const discountedUnitAmountCents = discountResult.discountedAmountCents;
  const discountPercentage = discountResult.discountPercentage;

  let appliedBannerMessage: string | null = null;
  if (discountPercentage > 0) {
    appliedBannerMessage = `Loyalty Reward: ${discountPercentage}% applied automatically because you are a ${tier} Member!`;
  }

  const lineItems: StripeLineItem[] = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: productName,
          description: appliedBannerMessage ? `${tier} Tier Discounted Price` : undefined,
        },
        unit_amount: discountedUnitAmountCents,
      },
      quantity,
    },
  ];

  return {
    userId,
    gamificationTier: tier,
    originalUnitAmountCents,
    discountedUnitAmountCents,
    discountPercentage,
    appliedBannerMessage,
    lineItems,
  };
}
