export interface TicketPaymentSplitInput {
  ticketPriceCents: number;
  quantity: number;
  platformFeePercent?: number; // Default 5% platform application fee
}

export interface StripeDestinationChargeParams {
  amountCents: number;
  applicationFeeAmountCents: number;
  destinationAccountId: string;
}

export interface ClubStripeOnboardingStatus {
  stripeAccountId?: string;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
}

export const DEFAULT_PLATFORM_FEE_PERCENT = 0.05; // 5% fee

/**
 * Calculates payment split between platform fee and destination club payout.
 */
export function calculatePaymentSplit(input: TicketPaymentSplitInput): {
  totalAmountCents: number;
  applicationFeeCents: number;
  clubPayoutCents: number;
} {
  const totalAmountCents = input.ticketPriceCents * input.quantity;
  const feePercent = input.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT;

  const applicationFeeCents = Math.round(totalAmountCents * feePercent);
  const clubPayoutCents = totalAmountCents - applicationFeeCents;

  return {
    totalAmountCents,
    applicationFeeCents,
    clubPayoutCents,
  };
}

/**
 * Formats parameters for Stripe Destination Charge checkout sessions.
 */
export function formatDestinationChargeParams(
  input: TicketPaymentSplitInput,
  destinationAccountId: string,
): StripeDestinationChargeParams {
  if (!destinationAccountId) {
    throw new Error("Connected Stripe Account ID is required for ticket routing.");
  }

  const { totalAmountCents, applicationFeeCents } = calculatePaymentSplit(input);

  return {
    amountCents: totalAmountCents,
    applicationFeeAmountCents: applicationFeeCents,
    destinationAccountId,
  };
}

/**
 * Verifies whether a club is ready to receive ticket sale payouts.
 */
export function canClubReceivePayouts(status: ClubStripeOnboardingStatus): boolean {
  return !!(status.stripeAccountId && status.payoutsEnabled && status.chargesEnabled);
}
