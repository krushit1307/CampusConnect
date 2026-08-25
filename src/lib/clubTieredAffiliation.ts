export type ClubLeaderboardRank = "Standard" | "Silver" | "Gold" | "Platinum";

export interface ClubAffiliationProfile {
  clubId: string;
  clubName: string;
  lifetimeRevenue: number;
  leaderboardRank: ClubLeaderboardRank;
}

export interface StripeFeeCalculationResult {
  ticketPrice: number;
  feePercentage: number;
  applicationFeeAmountCents: number;
  netClubPayoutCents: number;
  tierBadgeLabel: string;
  bannerMessage: string;
}

export const BASE_FEE_RATE = 0.05; // 5%
export const REDUCED_GOLD_FEE_RATE = 0.03; // 3%
export const REVENUE_GOLD_THRESHOLD = 10000;

/**
 * Resolves effective platform fee rate based on lifetime revenue or gamified rank.
 */
export function resolveClubFeeRate(
  lifetimeRevenue: number,
  leaderboardRank: ClubLeaderboardRank,
): { feePercentage: number; isReduced: boolean } {
  if (lifetimeRevenue >= 50000 || leaderboardRank === "Platinum") {
    return { feePercentage: 0.02, isReduced: true };
  }
  if (lifetimeRevenue >= REVENUE_GOLD_THRESHOLD || leaderboardRank === "Gold") {
    return { feePercentage: REDUCED_GOLD_FEE_RATE, isReduced: true };
  }
  if (lifetimeRevenue >= 2500 || leaderboardRank === "Silver") {
    return { feePercentage: 0.04, isReduced: true };
  }

  return { feePercentage: BASE_FEE_RATE, isReduced: false };
}

/**
 * Calculates Stripe Application Fee amount (in cents) for payment intent generation.
 */
export function calculateStripeApplicationFee(
  ticketPriceDollars: number,
  profile: ClubAffiliationProfile,
): StripeFeeCalculationResult {
  const { feePercentage, isReduced } = resolveClubFeeRate(
    profile.lifetimeRevenue,
    profile.leaderboardRank,
  );

  const priceCents = Math.round(ticketPriceDollars * 100);
  const applicationFeeAmountCents = Math.round(priceCents * feePercentage);
  const netClubPayoutCents = priceCents - applicationFeeAmountCents;

  const tierBadgeLabel = isReduced ? `${profile.leaderboardRank} Tier` : "Standard Tier";

  let bannerMessage = "Standard 5% platform fee applies.";
  if (isReduced) {
    bannerMessage = `You are a ${profile.leaderboardRank} Tier Club! Enjoy reduced platform fees (${(feePercentage * 100).toFixed(0)}%).`;
  }

  return {
    ticketPrice: ticketPriceDollars,
    feePercentage,
    applicationFeeAmountCents,
    netClubPayoutCents,
    tierBadgeLabel,
    bannerMessage,
  };
}
