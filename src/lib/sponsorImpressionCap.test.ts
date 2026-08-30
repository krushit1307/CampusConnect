import { describe, it, expect } from "vitest";
import {
  evaluateSponsorLogoRenderState,
  processSponsorClickAtomic,
  SponsorCampaignBudget,
} from "./sponsorImpressionCap";

describe("Develop Dynamic Sponsor Logo Impression Cap Suite (#4780)", () => {
  const activeCampaign: SponsorCampaignBudget = {
    sponsorshipId: "spons_tech_corp",
    sponsorName: "TechCorp",
    maxBudget: 100.0,
    currentSpend: 99.5, // 1 click away from $100 budget cap
    costPerClick: 0.5,
    isBudgetExhausted: false,
  };

  const exhaustedCampaign: SponsorCampaignBudget = {
    sponsorshipId: "spons_acme",
    sponsorName: "Acme Inc",
    maxBudget: 100.0,
    currentSpend: 100.0,
    costPerClick: 0.5,
    isBudgetExhausted: true,
  };

  it("permits logo rendering when current spend is strictly less than max budget", () => {
    const decision = evaluateSponsorLogoRenderState(activeCampaign);

    expect(decision.shouldRenderLogo).toBe(true);
    expect(decision.remainingBudget).toBe(0.5);
    expect(decision.reason).toBeUndefined();
  });

  it("suppresses logo rendering when current spend reaches or exceeds max budget", () => {
    const decision = evaluateSponsorLogoRenderState(exhaustedCampaign);

    expect(decision.shouldRenderLogo).toBe(false);
    expect(decision.remainingBudget).toBe(0);
    expect(decision.reason).toContain("Budget cap reached ($100.00 max)");
  });

  it("atomically increments spend and triggers WebSocket REMOVE_SPONSOR_LOGO payload when click exhausts budget", () => {
    const clickResult = processSponsorClickAtomic(activeCampaign);

    expect(clickResult.newSpend).toBe(100.0);
    expect(clickResult.isExhaustedNow).toBe(true);
    expect(clickResult.shouldRenderLogo).toBe(false);

    const wsPayload = clickResult.webSocketRemovalPayload;
    expect(wsPayload).not.toBeNull();
    expect(wsPayload?.eventType).toBe("REMOVE_SPONSOR_LOGO");
    expect(wsPayload?.sponsorshipId).toBe("spons_tech_corp");
    expect(wsPayload?.reason).toContain("Campaign budget exhausted ($100.00 / $100.00)");
  });
});
