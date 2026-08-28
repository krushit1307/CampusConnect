import { describe, it, expect } from "vitest";
import {
  calculateTierDiscountedAmount,
  buildDynamicStripeCheckoutPayload,
} from "./dynamicPricingGamification";

describe("Build Real-Time Dynamic Pricing Gamification Integration Suite (#4782)", () => {
  const baseTicketPriceCents = 10000; // $100.00 ticket

  it("calculates accurate 15% dynamic discount for Gold Tier members", () => {
    const { discountedAmountCents, discountPercentage } = calculateTierDiscountedAmount(
      baseTicketPriceCents,
      "Gold",
    );

    expect(discountPercentage).toBe(15);
    expect(discountedAmountCents).toBe(8500); // $85.00
  });

  it("dynamically rewrites Stripe line_items payload and generates banner for Gold Member", () => {
    const payload = buildDynamicStripeCheckoutPayload(
      "usr_gold_member",
      "Gold",
      "VIP Annual Gala Ticket",
      baseTicketPriceCents,
    );

    expect(payload.gamificationTier).toBe("Gold");
    expect(payload.discountPercentage).toBe(15);
    expect(payload.discountedUnitAmountCents).toBe(8500);
    expect(payload.lineItems[0].price_data.unit_amount).toBe(8500);
    expect(payload.appliedBannerMessage).toBe(
      "Loyalty Reward: 15% applied automatically because you are a Gold Member!",
    );
  });

  it("leaves standard pricing intact for Bronze Tier members with no banner message", () => {
    const payload = buildDynamicStripeCheckoutPayload(
      "usr_bronze_member",
      "Bronze",
      "Standard Event Ticket",
      baseTicketPriceCents,
    );

    expect(payload.discountPercentage).toBe(0);
    expect(payload.discountedUnitAmountCents).toBe(10000);
    expect(payload.lineItems[0].price_data.unit_amount).toBe(10000);
    expect(payload.appliedBannerMessage).toBeNull();
  });
});
