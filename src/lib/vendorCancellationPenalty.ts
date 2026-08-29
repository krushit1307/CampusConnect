export interface VendorContractDetails {
  contractId: string;
  clubId: string;
  vendorUserId: string;
  vendorName: string;
  contractAmount: number;
  eventStartDateIso: string;
}

export interface CancellationPenaltyEvaluation {
  contractId: string;
  vendorName: string;
  cancellationTimeIso: string;
  hoursUntilEvent: number;
  isSlaViolated: boolean;
  escrowRefundToClub: number;
  flakePenaltyDeductedFromVendor: number;
  totalClubDamagesPayout: number;
  stripeChargePayload: {
    vendorStripeAccountId: string;
    amountCents: number;
    description: string;
  } | null;
  summaryMessage: string;
}

export const SLA_VIOLATION_THRESHOLD_HOURS = 24.0;
export const FLAKE_PENALTY_RATE = 0.2; // 20% penalty

/**
 * Calculates hours between vendor cancellation timestamp and scheduled event start date.
 */
export function calculateHoursUntilEvent(
  cancellationTimeIso: string,
  eventStartDateIso: string,
): number {
  const cancelMs = new Date(cancellationTimeIso).getTime();
  const eventMs = new Date(eventStartDateIso).getTime();
  const diffHours = (eventMs - cancelMs) / (1000 * 60 * 60);
  return Number(diffHours.toFixed(2));
}

/**
 * Evaluates vendor cancellation SLA violation and computes 20% penalty damages payload.
 */
export function evaluateVendorCancellationPenalty(
  contract: VendorContractDetails,
  cancellationTimeIso: string = new Date().toISOString(),
  vendorStripeAccountId = "acct_vendor_stripe_default",
): CancellationPenaltyEvaluation {
  const hoursUntilEvent = calculateHoursUntilEvent(cancellationTimeIso, contract.eventStartDateIso);
  const isSlaViolated = hoursUntilEvent < SLA_VIOLATION_THRESHOLD_HOURS;

  const escrowRefundToClub = contract.contractAmount;
  let flakePenaltyDeductedFromVendor = 0.0;
  let stripeChargePayload = null;

  if (isSlaViolated) {
    flakePenaltyDeductedFromVendor = Number(
      (contract.contractAmount * FLAKE_PENALTY_RATE).toFixed(2),
    );

    stripeChargePayload = {
      vendorStripeAccountId,
      amountCents: Math.round(flakePenaltyDeductedFromVendor * 100),
      description: `SLA Breach Flake Penalty: 20% deduction for cancellation within 24h of event (${hoursUntilEvent}h remaining).`,
    };
  }

  const totalClubDamagesPayout = Number(
    (escrowRefundToClub + flakePenaltyDeductedFromVendor).toFixed(2),
  );

  let summaryMessage = `Cancellation processed. Full escrow refund of $${escrowRefundToClub.toFixed(2)} returned to club.`;
  if (isSlaViolated) {
    summaryMessage = `SLA Violation (<24h notice)! 100% Escrow ($${escrowRefundToClub.toFixed(
      2,
    )}) + 20% Vendor Flake Penalty ($${flakePenaltyDeductedFromVendor.toFixed(
      2,
    )}) awarded to club as damages.`;
  }

  return {
    contractId: contract.contractId,
    vendorName: contract.vendorName,
    cancellationTimeIso,
    hoursUntilEvent,
    isSlaViolated,
    escrowRefundToClub,
    flakePenaltyDeductedFromVendor,
    totalClubDamagesPayout,
    stripeChargePayload,
    summaryMessage,
  };
}
