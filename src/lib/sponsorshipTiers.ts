export interface SponsorshipTier {
  id: string;
  clubId: string;
  tierName: string;
  priceCents: number;
  benefits: string[];
  maxAvailable: number | null;
  purchasedCount: number;
  isActive: boolean;
}

export interface StripeCheckoutParams {
  tierId: string;
  clubId: string;
  companyName: string;
  companyLogoUrl: string;
  companyWebsiteUrl?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface FulfillmentPayload {
  clubId: string;
  tierId: string;
  companyName: string;
  companyLogoUrl: string;
  companyWebsiteUrl?: string;
  stripePaymentIntentId: string;
}

/**
 * Checks if a sponsorship tier is currently available for purchase.
 */
export function isTierAvailable(tier: SponsorshipTier): boolean {
  if (!tier.isActive) return false;
  if (tier.maxAvailable === null || tier.maxAvailable === undefined) return true;
  return tier.purchasedCount < tier.maxAvailable;
}

/**
 * Formats price in cents to clean USD display currency ($1,000.00).
 */
export function formatTierPrice(priceCents: number): string {
  const dollars = priceCents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollars);
}

/**
 * Constructs Stripe Checkout session payload for corporate sponsor purchases.
 */
export function buildStripeCheckoutPayload(params: StripeCheckoutParams, tier: SponsorshipTier) {
  if (!isTierAvailable(tier)) {
    throw new Error(`Sponsorship tier "${tier.tierName}" is sold out or inactive.`);
  }

  return {
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${tier.tierName} Sponsorship`,
            description: `Sponsorship perks: ${tier.benefits.join(", ")}`,
          },
          unit_amount: tier.priceCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      club_id: params.clubId,
      tier_id: params.tierId,
      company_name: params.companyName,
      company_logo_url: params.companyLogoUrl,
      company_website_url: params.companyWebsiteUrl || "",
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };
}

/**
 * Formats corporate branding perks for automatic event logo embedding upon webhook verification.
 */
export function executeWebhookPerksFulfillment(
  payload: FulfillmentPayload,
  existingEventLogos: string[] = [],
): { updatedLogos: string[]; isSuccess: boolean } {
  if (existingEventLogos.includes(payload.companyLogoUrl)) {
    return { updatedLogos: existingEventLogos, isSuccess: true };
  }

  return {
    updatedLogos: [...existingEventLogos, payload.companyLogoUrl],
    isSuccess: true,
  };
}
