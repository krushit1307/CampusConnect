import { describe, it, expect } from "vitest";
import {
  formatCents,
  getCampaignProgressPercent,
  isCampaignEnded,
  type CrowdfundingCampaign,
} from "./crowdfunding";

function makeCampaign(overrides: Partial<CrowdfundingCampaign> = {}): CrowdfundingCampaign {
  return {
    id: "campaign-1",
    club_id: "club-1",
    title: "Send the Robotics team to Nationals",
    description: null,
    target_amount_cents: 500000, // $5,000
    current_amount_cents: 0,
    end_date: null,
    status: "active",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("formatCents", () => {
  it("formats whole-dollar amounts without decimals", () => {
    expect(formatCents(500000)).toBe("$5,000");
  });

  it("formats amounts with cents", () => {
    expect(formatCents(512345)).toBe("$5,123.45");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0");
  });
});

describe("getCampaignProgressPercent", () => {
  it("returns 0 for a fresh campaign", () => {
    expect(getCampaignProgressPercent(makeCampaign({ current_amount_cents: 0 }))).toBe(0);
  });

  it("returns the correct percentage partway to goal", () => {
    const campaign = makeCampaign({ target_amount_cents: 100000, current_amount_cents: 80000 });
    expect(getCampaignProgressPercent(campaign)).toBe(80);
  });

  it("returns exactly 100 when the goal is exactly met", () => {
    const campaign = makeCampaign({ target_amount_cents: 100000, current_amount_cents: 100000 });
    expect(getCampaignProgressPercent(campaign)).toBe(100);
  });

  // Edge case from the spec: "Goal exceeded — If the goal is $1000 and someone
  // donates $500 when it's at $800, the bar shouldn't visually break out of
  // its container (cap the visual width at 100%)."
  it("caps the visual percent at 100 even when the campaign is overfunded", () => {
    // $800 already raised, +$500 donation on a $1000 goal => $1300 raised (130%)
    const campaign = makeCampaign({ target_amount_cents: 100000, current_amount_cents: 130000 });
    expect(getCampaignProgressPercent(campaign)).toBe(100);
  });

  it("never returns a negative percent for a zero/invalid target", () => {
    const campaign = makeCampaign({ target_amount_cents: 0, current_amount_cents: 5000 });
    expect(getCampaignProgressPercent(campaign)).toBe(0);
  });
});

describe("isCampaignEnded", () => {
  it("is false for an active campaign with no end date", () => {
    expect(isCampaignEnded(makeCampaign({ status: "active", end_date: null }))).toBe(false);
  });

  it("is true once status is no longer active", () => {
    expect(isCampaignEnded(makeCampaign({ status: "completed" }))).toBe(true);
    expect(isCampaignEnded(makeCampaign({ status: "cancelled" }))).toBe(true);
  });

  it("is true once the end_date has passed, even if status is still active", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isCampaignEnded(makeCampaign({ status: "active", end_date: yesterday }))).toBe(true);
  });

  it("is false when the end_date is in the future", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isCampaignEnded(makeCampaign({ status: "active", end_date: tomorrow }))).toBe(false);
  });
});
