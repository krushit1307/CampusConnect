import { describe, it, expect } from "vitest";
import {
  calculateCampaignProgress,
  processGroupBuyCommit,
  evaluateCampaignExpiration,
  GroupBuyCampaign,
} from "./groupBuyAvalanche";

describe("Group Buy Avalanche Pricing Engine Utility (#4893)", () => {
  const sampleCampaign: GroupBuyCampaign = {
    campaignId: "gbu-gala-2026",
    eventId: "evt-gala-1",
    originalPrice: 30.0,
    discountedPrice: 15.0,
    targetCommitsCount: 100,
    currentCommitsCount: 84,
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    status: "active",
  };

  it("calculates progress percentage, remaining commits needed, and discount percent", () => {
    const progress = calculateCampaignProgress(85, 100, 30.0, 15.0);

    expect(progress.percent).toBe(85);
    expect(progress.remaining).toBe(15);
    expect(progress.discountPercent).toBe(50);
  });

  it("authorizes $30 card hold (Auth without Capture) when target is not yet reached", () => {
    const { updatedCampaign, commitResult } = processGroupBuyCommit(sampleCampaign, "u-student-1");

    expect(updatedCampaign.currentCommitsCount).toBe(85);
    expect(updatedCampaign.status).toBe("active");
    expect(commitResult.authorizedPrice).toBe(30.0);
    expect(commitResult.status).toBe("authorized");
    expect(commitResult.isTargetReached).toBe(false);
  });

  it("triggers batch Stripe capture at $15 discounted rate when target (100) is hit", () => {
    const nearTargetCampaign: GroupBuyCampaign = {
      ...sampleCampaign,
      currentCommitsCount: 99,
    };

    const { updatedCampaign, commitResult } = processGroupBuyCommit(nearTargetCampaign, "u-student-100");

    expect(updatedCampaign.currentCommitsCount).toBe(100);
    expect(updatedCampaign.status).toBe("successful");
    expect(commitResult.status).toBe("captured");
    expect(commitResult.isTargetReached).toBe(true);
    expect(commitResult.finalCapturedPrice).toBe(15.0);
  });

  it("releases all card holds and sets status to failed if timer expires before target", () => {
    const failedCampaign: GroupBuyCampaign = {
      ...sampleCampaign,
      currentCommitsCount: 90,
    };

    const expired = evaluateCampaignExpiration(failedCampaign);

    expect(expired.status).toBe("failed");
  });
});
