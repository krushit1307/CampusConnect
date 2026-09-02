import { describe, it, expect } from "vitest";
import {
  getMatchedDonationTier,
  validateDonationAmount,
  DEFAULT_DONATION_TIERS,
} from "./donationSliderService";

describe("donationSliderService", () => {
  it("matches appropriate impact tiers dynamically", () => {
    const tier10 = getMatchedDonationTier(10, DEFAULT_DONATION_TIERS);
    expect(tier10?.amount).toBe(10);
    expect(tier10?.impact).toContain("textbook");

    const tier50 = getMatchedDonationTier(75, DEFAULT_DONATION_TIERS);
    expect(tier50?.amount).toBe(50);
    expect(tier50?.impact).toContain("laboratory desk");

    const tier500 = getMatchedDonationTier(600, DEFAULT_DONATION_TIERS);
    expect(tier500?.amount).toBe(500);
    expect(tier500?.impact).toContain("travel stipends");
  });

  it("enforces minimum ticket prices properly", () => {
    const invalid = validateDonationAmount(5, 10, 1000);
    expect(invalid.isValid).toBe(false);
    expect(invalid.error).toContain("Minimum ticket price is $10");

    const valid = validateDonationAmount(50.4, 10, 1000);
    expect(valid.isValid).toBe(true);
    expect(valid.integerAmount).toBe(50);
  });
});
