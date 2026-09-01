import { describe, it, expect } from "vitest";
import {
  validateMilestonesDefinition,
  generateContractMilestones,
  calculateFinancialProgressBar,
  executeMilestoneRelease,
  ContractMilestoneDefinition,
  EscrowMilestoneRecord,
} from "./escrowMilestonePayouts";

describe("Build Interactive Vendor Bidding Escrow Milestone Payouts Suite (#4821)", () => {
  const contractTotal = 10000.0; // $10,000 festival stage contract

  const milestoneDefs: ContractMilestoneDefinition[] = [
    { title: "Stage Setup Complete", order: 1, percentage: 30 },
    { title: "Day 1 Complete", order: 2, percentage: 30 },
    { title: "Tear-down Complete", order: 3, percentage: 40 },
  ];

  it("validates milestone percentages summing to 100%", () => {
    expect(validateMilestonesDefinition(milestoneDefs)).toBe(true);

    const invalidDefs: ContractMilestoneDefinition[] = [
      { title: "Phase 1", order: 1, percentage: 50 },
      { title: "Phase 2", order: 2, percentage: 20 },
    ];
    expect(validateMilestonesDefinition(invalidDefs)).toBe(false);
  });

  it("generates milestone records with proportional monetary payout amounts", () => {
    const milestones = generateContractMilestones("ctr_fest_stage", contractTotal, milestoneDefs);

    expect(milestones.length).toBe(3);
    expect(milestones[0].payoutAmount).toBe(3000.0); // 30% of $10,000
    expect(milestones[1].payoutAmount).toBe(3000.0);
    expect(milestones[2].payoutAmount).toBe(4000.0); // 40% of $10,000
  });

  it("releases partial milestone 1 (30%) via Stripe Connect transfer while leaving 70% locked", () => {
    const milestones = generateContractMilestones("ctr_fest_stage", contractTotal, milestoneDefs);

    // Simulate organizer verifying photo evidence for Milestone 1
    const verifiedMilestone1: EscrowMilestoneRecord = {
      ...milestones[0],
      isEvidenceVerified: true,
    };

    const releaseResult = executeMilestoneRelease(
      verifiedMilestone1,
      milestones,
      contractTotal,
      "acct_stage_vendor_01",
    );

    expect(releaseResult.releasedAmount).toBe(3000.0);
    expect(releaseResult.stripeTransferPayload.amountCents).toBe(300000); // $3000 in cents
    expect(releaseResult.stripeTransferPayload.vendorStripeAccountId).toBe("acct_stage_vendor_01");

    // Verify Financial Progress Bar state
    expect(releaseResult.updatedFinancialState.totalReleasedAmount).toBe(3000.0);
    expect(releaseResult.updatedFinancialState.remainingLockedAmount).toBe(7000.0);
    expect(releaseResult.updatedFinancialState.progressPercentage).toBe(30.0);
    expect(releaseResult.updatedFinancialState.completedMilestonesCount).toBe(1);
  });

  it("blocks release if photo evidence has not been verified", () => {
    const milestones = generateContractMilestones("ctr_fest_stage", contractTotal, milestoneDefs);
    const unverifiedMilestone = milestones[0];

    expect(() =>
      executeMilestoneRelease(
        unverifiedMilestone,
        milestones,
        contractTotal,
        "acct_stage_vendor_01",
      ),
    ).toThrow("Cannot release milestone escrow: deliverable photo evidence is not verified.");
  });
});
