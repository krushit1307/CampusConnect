import { describe, it, expect } from "vitest";
import {
  resolveClubFeeRate,
  calculateStripeApplicationFee,
  ClubAffiliationProfile,
} from "./clubTieredAffiliation";

describe("Develop Dynamic Club Revenue Tiered Affiliation Suite (#4488)", () => {
  const standardClub: ClubAffiliationProfile = {
    clubId: "club_chess",
    clubName: "Chess Club",
    lifetimeRevenue: 1500,
    leaderboardRank: "Standard",
  };

  const highRevenueClub: ClubAffiliationProfile = {
    clubId: "club_esports",
    clubName: "Esports Club",
    lifetimeRevenue: 12500, // > $10,000 threshold
    leaderboardRank: "Standard",
  };

  const goldRankClub: ClubAffiliationProfile = {
    clubId: "club_hackathon",
    clubName: "Hackathon Org",
    lifetimeRevenue: 4000,
    leaderboardRank: "Gold",
  };

  it("applies standard 5% fee rate for clubs below $10,000 lifetime revenue", () => {
    const rate = resolveClubFeeRate(standardClub.lifetimeRevenue, standardClub.leaderboardRank);
    expect(rate.feePercentage).toBe(0.05);
    expect(rate.isReduced).toBe(false);

    const fee = calculateStripeApplicationFee(100.0, standardClub);
    expect(fee.applicationFeeAmountCents).toBe(500); // $5.00 on $100 ticket
    expect(fee.bannerMessage).toContain("Standard 5% platform fee applies");
  });

  it("dynamically overrides platform fee to 3% when lifetime revenue exceeds $10,000", () => {
    const rate = resolveClubFeeRate(
      highRevenueClub.lifetimeRevenue,
      highRevenueClub.leaderboardRank,
    );
    expect(rate.feePercentage).toBe(0.03);
    expect(rate.isReduced).toBe(true);

    const fee = calculateStripeApplicationFee(100.0, highRevenueClub);
    expect(fee.applicationFeeAmountCents).toBe(300); // $3.00 on $100 ticket (3% instead of 5%)
    expect(fee.bannerMessage).toContain("Enjoy reduced platform fees (3%)");
  });

  it("dynamically overrides platform fee to 3% when leaderboard rank is Gold regardless of revenue", () => {
    const fee = calculateStripeApplicationFee(100.0, goldRankClub);
    expect(fee.feePercentage).toBe(0.03);
    expect(fee.applicationFeeAmountCents).toBe(300);
    expect(fee.bannerMessage).toContain("You are a Gold Tier Club! Enjoy reduced platform fees");
  });
});
