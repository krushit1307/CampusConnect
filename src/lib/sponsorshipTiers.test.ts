import { describe, it, expect } from "vitest";
import {
  isTierAvailable,
  formatTierPrice,
  buildStripeCheckoutPayload,
  executeWebhookPerksFulfillment,
  SponsorshipTier,
  StripeCheckoutParams,
} from "./sponsorshipTiers";

describe("Develop Dynamic Sponsorship Tier Creator Suite (#3883)", () => {
  const goldTier: SponsorshipTier = {
    id: "tier_gold",
    clubId: "club_robotics",
    tierName: "Gold Tier",
    priceCents: 100000, // $1,000.00
    benefits: ["Logo on Banner", "API Access", "Social Media Shoutout"],
    maxAvailable: 5,
    purchasedCount: 2,
    isActive: true,
  };

  const soldOutTier: SponsorshipTier = {
    ...goldTier,
    id: "tier_soldout",
    purchasedCount: 5,
  };

  const checkoutParams: StripeCheckoutParams = {
    tierId: "tier_gold",
    clubId: "club_robotics",
    companyName: "Acme Corp",
    companyLogoUrl: "https://acme.com/logo.png",
    companyWebsiteUrl: "https://acme.com",
    successUrl: "https://campusconnect.edu/success",
    cancelUrl: "https://campusconnect.edu/cancel",
  };

  it("checks availability and formats tier price correctly", () => {
    expect(isTierAvailable(goldTier)).toBe(true);
    expect(isTierAvailable(soldOutTier)).toBe(false);
    expect(formatTierPrice(100000)).toBe("$1,000");
  });

  it("builds Stripe checkout session payload with metadata for corporate user", () => {
    const payload = buildStripeCheckoutPayload(checkoutParams, goldTier);

    expect(payload.mode).toBe("payment");
    expect(payload.line_items[0].price_data.unit_amount).toBe(100000);
    expect(payload.metadata.company_name).toBe("Acme Corp");
    expect(payload.metadata.company_logo_url).toBe("https://acme.com/logo.png");
  });

  it("throws error when trying to purchase a sold-out tier", () => {
    expect(() => buildStripeCheckoutPayload(checkoutParams, soldOutTier)).toThrow(
      'Sponsorship tier "Gold Tier" is sold out or inactive.',
    );
  });

  it("automatically appends sponsor logo to event asset placement payload upon webhook verification", () => {
    const webhookData = {
      clubId: "club_robotics",
      tierId: "tier_gold",
      companyName: "Acme Corp",
      companyLogoUrl: "https://acme.com/logo.png",
      stripePaymentIntentId: "pi_12345",
    };

    const result = executeWebhookPerksFulfillment(webhookData, ["https://other.com/logo.png"]);

    expect(result.isSuccess).toBe(true);
    expect(result.updatedLogos.length).toBe(2);
    expect(result.updatedLogos).toContain("https://acme.com/logo.png");
  });
});
