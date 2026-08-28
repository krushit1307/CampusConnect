export interface SponsorCampaignBudget {
  sponsorshipId: string;
  sponsorName: string;
  maxBudget: number;
  currentSpend: number;
  costPerClick: number;
  isBudgetExhausted: boolean;
}

export interface RenderDecisionResult {
  sponsorshipId: string;
  shouldRenderLogo: boolean;
  remainingBudget: number;
  reason?: string;
}

export interface ClickTrackResult {
  sponsorshipId: string;
  newSpend: number;
  isExhaustedNow: boolean;
  shouldRenderLogo: boolean;
  webSocketRemovalPayload: {
    eventType: "REMOVE_SPONSOR_LOGO";
    sponsorshipId: string;
    sponsorName: string;
    reason: string;
  } | null;
}

/**
 * Checks if a sponsor logo should be rendered on the Event Page based on Redis/DB spending state.
 */
export function evaluateSponsorLogoRenderState(
  campaign: SponsorCampaignBudget,
): RenderDecisionResult {
  const remainingBudget = Number(
    Math.max(0, campaign.maxBudget - campaign.currentSpend).toFixed(2),
  );

  if (campaign.isBudgetExhausted || campaign.currentSpend >= campaign.maxBudget) {
    return {
      sponsorshipId: campaign.sponsorshipId,
      shouldRenderLogo: false,
      remainingBudget: 0,
      reason: `Budget cap reached ($${campaign.maxBudget.toFixed(2)} max). Suppressing render.`,
    };
  }

  return {
    sponsorshipId: campaign.sponsorshipId,
    shouldRenderLogo: true,
    remainingBudget,
  };
}

/**
 * Simulates atomic Redis INCRBYFLOAT increment and returns WebSocket removal payload if budget cap is breached.
 */
export function processSponsorClickAtomic(campaign: SponsorCampaignBudget): ClickTrackResult {
  if (campaign.isBudgetExhausted) {
    return {
      sponsorshipId: campaign.sponsorshipId,
      newSpend: campaign.currentSpend,
      isExhaustedNow: true,
      shouldRenderLogo: false,
      webSocketRemovalPayload: null,
    };
  }

  const newSpend = Number((campaign.currentSpend + campaign.costPerClick).toFixed(2));
  const isExhaustedNow = newSpend >= campaign.maxBudget;

  let webSocketRemovalPayload = null;
  if (isExhaustedNow) {
    webSocketRemovalPayload = {
      eventType: "REMOVE_SPONSOR_LOGO" as const,
      sponsorshipId: campaign.sponsorshipId,
      sponsorName: campaign.sponsorName,
      reason: `Campaign budget exhausted ($${newSpend.toFixed(2)} / $${campaign.maxBudget.toFixed(2)}).`,
    };
  }

  return {
    sponsorshipId: campaign.sponsorshipId,
    newSpend,
    isExhaustedNow,
    shouldRenderLogo: !isExhaustedNow,
    webSocketRemovalPayload,
  };
}
