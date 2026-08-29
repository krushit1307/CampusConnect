import { describe, it, expect } from "vitest";
import {
  calculateHoursUntilEvent,
  evaluateVendorCancellationPenalty,
  VendorContractDetails,
} from "./vendorCancellationPenalty";

describe("Implement Automated Event Cancellation Vendor Penalty Enforcement Suite (#4784)", () => {
  const sampleContract: VendorContractDetails = {
    contractId: "ctr_dj_party",
    clubId: "club_campus_events",
    vendorUserId: "usr_dj_spin",
    vendorName: "DJ Spin Master",
    contractAmount: 1000.0, // $1000 contract
    eventStartDateIso: "2026-08-28T20:00:00Z",
  };

  it("calculates precise hours delta between cancellation and event start", () => {
    // Cancelled 3 hours before
    const cancelTime3h = "2026-08-28T17:00:00Z";
    expect(calculateHoursUntilEvent(cancelTime3h, sampleContract.eventStartDateIso)).toBe(3.0);
  });

  it("enforces 20% Flake Penalty and damages payout when vendor cancels < 24 hours before event", () => {
    // Vendor cancels 3 hours before event
    const cancelTime = "2026-08-28T17:00:00Z";
    const result = evaluateVendorCancellationPenalty(sampleContract, cancelTime, "acct_dj_spin");

    expect(result.isSlaViolated).toBe(true);
    expect(result.hoursUntilEvent).toBe(3.0);
    expect(result.escrowRefundToClub).toBe(1000.0);
    expect(result.flakePenaltyDeductedFromVendor).toBe(200.0); // 20% of $1000
    expect(result.totalClubDamagesPayout).toBe(1200.0); // $1000 refund + $200 damages

    expect(result.stripeChargePayload).not.toBeNull();
    expect(result.stripeChargePayload?.amountCents).toBe(20000); // $200 in cents
    expect(result.stripeChargePayload?.vendorStripeAccountId).toBe("acct_dj_spin");
    expect(result.summaryMessage).toContain("SLA Violation (<24h notice)!");
  });

  it("waives penalty and returns standard escrow refund when cancellation notice >= 24 hours", () => {
    // Vendor cancels 48 hours before event
    const advanceCancelTime = "2026-08-26T20:00:00Z";
    const result = evaluateVendorCancellationPenalty(
      sampleContract,
      advanceCancelTime,
      "acct_dj_spin",
    );

    expect(result.isSlaViolated).toBe(false);
    expect(result.hoursUntilEvent).toBe(48.0);
    expect(result.escrowRefundToClub).toBe(1000.0);
    expect(result.flakePenaltyDeductedFromVendor).toBe(0.0);
    expect(result.totalClubDamagesPayout).toBe(1000.0);
    expect(result.stripeChargePayload).toBeNull();
  });
});
