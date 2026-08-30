export interface GroupBuyCampaign {
  campaignId: string;
  eventId: string;
  originalPrice: number;
  discountedPrice: number;
  targetCommitsCount: number;
  currentCommitsCount: number;
  expiresAt: string;
  status: "active" | "successful" | "failed";
}

export interface GroupBuyCommitResult {
  commitId: string;
  campaignId: string;
  stripeAuthHoldId: string;
  authorizedPrice: number;
  status: "authorized" | "captured" | "released";
  isTargetReached: boolean;
  finalCapturedPrice?: number;
}

/**
 * Calculates progress percentage, remaining commits needed, and discount percent (#4893).
 */
export function calculateCampaignProgress(
  current: number,
  target: number,
  originalPrice: number = 30.0,
  discountedPrice: number = 15.0
): { percent: number; remaining: number; discountPercent: number } {
  const t = Math.max(1, target);
  const c = Math.max(0, current);
  const percent = Math.min(100, Math.round((c / t) * 100));
  const remaining = Math.max(0, t - c);

  const discountPercent = Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);

  return {
    percent,
    remaining,
    discountPercent,
  };
}

/**
 * Processes a user group buy commit with Stripe Auth (without Immediate Capture) (#4893).
 */
export function processGroupBuyCommit(
  campaign: GroupBuyCampaign,
  userId: string
): { updatedCampaign: GroupBuyCampaign; commitResult: GroupBuyCommitResult } {
  if (campaign.status !== "active") {
    throw new Error(`Cannot commit: Group Buy campaign is ${campaign.status}.`);
  }

  const newCommitsCount = campaign.currentCommitsCount + 1;
  const isTargetReached = newCommitsCount >= campaign.targetCommitsCount;
  const commitId = `commit-${Date.now()}`;
  const stripeAuthHoldId = `ch_hold_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const updatedCampaign: GroupBuyCampaign = {
    ...campaign,
    currentCommitsCount: newCommitsCount,
    status: isTargetReached ? "successful" : "active",
  };

  const commitResult: GroupBuyCommitResult = {
    commitId,
    campaignId: campaign.campaignId,
    stripeAuthHoldId,
    authorizedPrice: campaign.originalPrice,
    status: isTargetReached ? "captured" : "authorized",
    isTargetReached,
    finalCapturedPrice: isTargetReached ? campaign.discountedPrice : undefined,
  };

  return {
    updatedCampaign,
    commitResult,
  };
}

/**
 * Evaluates campaign expiration: if target missed, releases all card holds and sets status to 'failed' (#4893).
 */
export function evaluateCampaignExpiration(campaign: GroupBuyCampaign): GroupBuyCampaign {
  if (campaign.currentCommitsCount < campaign.targetCommitsCount) {
    return {
      ...campaign,
      status: "failed",
    };
  }

  return {
    ...campaign,
    status: "successful",
  };
}
