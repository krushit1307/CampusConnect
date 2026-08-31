export type DonorTier = "None" | "Bronze" | "Silver" | "Gold" | "Platinum";

export interface UserDonorProfile {
  userId: string;
  userName: string;
  lifetimeDonations: number;
  donorTier: DonorTier;
}

export interface DonorBadgeConfig {
  tier: DonorTier;
  label: string;
  badgeCssClass: string;
  glowEffectCss?: string;
  iconSymbol: string;
}

export interface DonationTierCalculationResult {
  userId: string;
  previousTotal: number;
  newTotal: number;
  previousTier: DonorTier;
  newTier: DonorTier;
  isTierUpgraded: boolean;
  badgeConfig: DonorBadgeConfig | null;
  webSocketBroadcastPayload: {
    eventType: "DONOR_TIER_UPGRADED" | "DONATION_RECEIVED";
    userId: string;
    userName: string;
    newTier: DonorTier;
    badgeConfig: DonorBadgeConfig | null;
  };
}

export const TIER_THRESHOLDS = {
  BRONZE: 100,
  SILVER: 500,
  GOLD: 1000,
  PLATINUM: 5000,
};

/**
 * Resolves donor tier based on cumulative financial contribution.
 */
export function resolveDonorTier(totalDonations: number): DonorTier {
  if (totalDonations >= TIER_THRESHOLDS.PLATINUM) return "Platinum";
  if (totalDonations >= TIER_THRESHOLDS.GOLD) return "Gold";
  if (totalDonations >= TIER_THRESHOLDS.SILVER) return "Silver";
  if (totalDonations >= TIER_THRESHOLDS.BRONZE) return "Bronze";
  return "None";
}

/**
 * Returns UI badge metadata and glowing CSS classes for persistent chat rendering.
 */
export function getDonorBadgeConfig(tier: DonorTier): DonorBadgeConfig | null {
  switch (tier) {
    case "Platinum":
      return {
        tier: "Platinum",
        label: "Platinum Donor",
        badgeCssClass: "bg-cyan-100 text-cyan-800 border-cyan-400 font-bold",
        glowEffectCss: "shadow-[0_0_12px_rgba(6,182,212,0.8)] animate-pulse",
        iconSymbol: "💎",
      };
    case "Gold":
      return {
        tier: "Gold",
        label: "Gold Donor",
        badgeCssClass: "bg-amber-100 text-amber-800 border-amber-400 font-bold",
        glowEffectCss: "shadow-[0_0_10px_rgba(245,158,11,0.7)]",
        iconSymbol: "👑",
      };
    case "Silver":
      return {
        tier: "Silver",
        label: "Silver Donor",
        badgeCssClass: "bg-slate-200 text-slate-700 border-slate-400",
        iconSymbol: "🥈",
      };
    case "Bronze":
      return {
        tier: "Bronze",
        label: "Bronze Donor",
        badgeCssClass: "bg-orange-100 text-orange-800 border-orange-300",
        iconSymbol: "🥉",
      };
    default:
      return null;
  }
}

/**
 * Calculates updated tier upon new donation and formats WebSocket broadcast payload.
 */
export function processUserDonationTierUpdate(
  profile: UserDonorProfile,
  donationAmount: number,
): DonationTierCalculationResult {
  const previousTotal = profile.lifetimeDonations;
  const newTotal = previousTotal + donationAmount;
  const previousTier = profile.donorTier;
  const newTier = resolveDonorTier(newTotal);

  const isTierUpgraded = previousTier !== newTier && newTier !== "None";
  const badgeConfig = getDonorBadgeConfig(newTier);

  return {
    userId: profile.userId,
    previousTotal,
    newTotal,
    previousTier,
    newTier,
    isTierUpgraded,
    badgeConfig,
    webSocketBroadcastPayload: {
      eventType: isTierUpgraded ? "DONOR_TIER_UPGRADED" : "DONATION_RECEIVED",
      userId: profile.userId,
      userName: profile.userName,
      newTier,
      badgeConfig,
    },
  };
}
