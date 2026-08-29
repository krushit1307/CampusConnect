import { describe, it, expect } from "vitest";
import {
  resolveDonorTier,
  getDonorBadgeConfig,
  processUserDonationTierUpdate,
  UserDonorProfile,
} from "./donorTierBadges";

describe("Build Real-Time Donation Goal Donor Tier Badges Suite (#4538)", () => {
  const sampleUser: UserDonorProfile = {
    userId: "usr_donor_bob",
    userName: "Bob Vance",
    lifetimeDonations: 450.0, // Currently below $500 (Bronze)
    donorTier: "Bronze",
  };

  it("resolves accurate tier levels based on cumulative donation amounts", () => {
    expect(resolveDonorTier(50)).toBe("None");
    expect(resolveDonorTier(100)).toBe("Bronze");
    expect(resolveDonorTier(500)).toBe("Silver");
    expect(resolveDonorTier(1000)).toBe("Gold");
    expect(resolveDonorTier(5000)).toBe("Platinum");
  });

  it("upgrades user tier and constructs glowing Gold Badge config when donation hits $1000", () => {
    // User donates $550 ($450 + $550 = $1000 Gold Tier)
    const result = processUserDonationTierUpdate(sampleUser, 550.0);

    expect(result.newTotal).toBe(1000.0);
    expect(result.previousTier).toBe("Bronze");
    expect(result.newTier).toBe("Gold");
    expect(result.isTierUpgraded).toBe(true);

    expect(result.badgeConfig).not.toBeNull();
    expect(result.badgeConfig?.tier).toBe("Gold");
    expect(result.badgeConfig?.glowEffectCss).toContain("shadow-[0_0_10px");
    expect(result.badgeConfig?.iconSymbol).toBe("👑");
  });

  it("constructs WebSocket broadcast payload for live Q&A UI injection", () => {
    const result = processUserDonationTierUpdate(sampleUser, 550.0);
    const ws = result.webSocketBroadcastPayload;

    expect(ws.eventType).toBe("DONOR_TIER_UPGRADED");
    expect(ws.userId).toBe("usr_donor_bob");
    expect(ws.userName).toBe("Bob Vance");
    expect(ws.newTier).toBe("Gold");
  });
});
