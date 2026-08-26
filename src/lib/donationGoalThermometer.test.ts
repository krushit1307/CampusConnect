import { describe, it, expect } from "vitest";
import {
  formatDonationCurrency,
  calculateCampaignProgress,
  addDonationToCampaign,
  DonationCampaignSummary,
} from "./donationGoalThermometer";

describe("Donation Goal Thermometer Utility (#4402)", () => {
  const initialSummary: DonationCampaignSummary = {
    campaignId: "camp-robotics-1",
    title: "National Robotics Competition Fund",
    targetAmount: 5000,
    currentAmount: 2000,
    progressPercentage: 40,
    isGoalReached: false,
    recentDonors: [
      { id: "d-1", campaignId: "camp-robotics-1", donorName: "Alice Vance", amount: 50, createdAt: "2026-08-26T10:00:00Z" },
    ],
  };

  it("formats currency values into whole dollar amounts", () => {
    expect(formatDonationCurrency(2000)).toBe("$2,000");
    expect(formatDonationCurrency(5000)).toBe("$5,000");
  });

  it("calculates campaign progress percentage and goal reached status", () => {
    const progress40 = calculateCampaignProgress(5000, 2000);
    expect(progress40.progressPercentage).toBe(40);
    expect(progress40.isGoalReached).toBe(false);

    const progress100 = calculateCampaignProgress(5000, 5000);
    expect(progress100.progressPercentage).toBe(100);
    expect(progress100.isGoalReached).toBe(true);
  });

  it("adds donation to campaign, updates current total, and prepends to ticker list", () => {
    const updated = addDonationToCampaign(initialSummary, "Bob Chen", 500);

    expect(updated.currentAmount).toBe(2500);
    expect(updated.progressPercentage).toBe(50);
    expect(updated.recentDonors).toHaveLength(2);
    expect(updated.recentDonors[0].donorName).toBe("Bob Chen");
    expect(updated.recentDonors[0].amount).toBe(500);
  });
});
