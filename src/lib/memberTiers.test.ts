import { describe, it, expect } from "vitest";
import {
  getMemberTier,
  getNextTierProgress,
  getAvatarTierClasses,
} from "./memberTiers";

describe("Member Tier & Status Progression Utility (#3461)", () => {
  it("resolves correct status tier based on total points", () => {
    expect(getMemberTier(0).id).toBe("bronze");
    expect(getMemberTier(499).id).toBe("bronze");
    expect(getMemberTier(500).id).toBe("silver");
    expect(getMemberTier(1499).id).toBe("silver");
    expect(getMemberTier(1500).id).toBe("gold");
    expect(getMemberTier(3499).id).toBe("gold");
    expect(getMemberTier(3500).id).toBe("platinum");
    expect(getMemberTier(10000).id).toBe("platinum");
  });

  it("calculates points remaining and percentage towards next tier", () => {
    // 1450 points -> Silver Tier, 50 points away from Gold (1500 minPoints)
    const progress = getNextTierProgress(1450);

    expect(progress.currentTier.id).toBe("silver");
    expect(progress.nextTier?.id).toBe("gold");
    expect(progress.pointsRemaining).toBe(50);
    expect(progress.progressPercent).toBe(95); // (1450-500)/(1500-500) = 950/1000 = 95%
  });

  it("handles max Platinum tier correctly with 100% progress and no next tier", () => {
    const progress = getNextTierProgress(4000);

    expect(progress.currentTier.id).toBe("platinum");
    expect(progress.nextTier).toBeNull();
    expect(progress.pointsRemaining).toBe(0);
    expect(progress.progressPercent).toBe(100);
  });

  it("returns dynamic avatar tier CSS classes for visual flairs", () => {
    const goldClasses = getAvatarTierClasses(1500);
    const platinumClasses = getAvatarTierClasses(3500);

    expect(goldClasses).toContain("border-amber-400");
    expect(platinumClasses).toContain("animate-pulse");
  });
});
