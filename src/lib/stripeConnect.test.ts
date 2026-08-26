import { describe, it, expect } from "vitest";
import {
  calculatePaymentSplit,
  formatDestinationChargeParams,
  canClubReceivePayouts,
} from "./stripeConnect";

describe("Stripe Connect Ticket Routing Suite (#2721)", () => {
  it("calculates 5% platform application fee and net club payout accurately", () => {
    // $20 ticket * 2 quantity = $40.00 (4000 cents)
    const split = calculatePaymentSplit({
      ticketPriceCents: 2000,
      quantity: 2,
    });

    expect(split.totalAmountCents).toBe(4000);
    expect(split.applicationFeeCents).toBe(200); // 5% of $40 = $2.00 (200 cents)
    expect(split.clubPayoutCents).toBe(3800); // $38.00 to club
  });

  it("formats destination charge parameters for Stripe checkout payload", () => {
    const params = formatDestinationChargeParams(
      { ticketPriceCents: 1000, quantity: 1 },
      "acct_club_12345",
    );

    expect(params.amountCents).toBe(1000);
    expect(params.applicationFeeAmountCents).toBe(50);
    expect(params.destinationAccountId).toBe("acct_club_12345");
  });

  it("verifies if a club account is ready to process payouts", () => {
    expect(
      canClubReceivePayouts({
        stripeAccountId: "acct_club_12345",
        payoutsEnabled: true,
        chargesEnabled: true,
      }),
    ).toBe(true);

    expect(
      canClubReceivePayouts({
        stripeAccountId: "acct_club_12345",
        payoutsEnabled: false,
        chargesEnabled: true,
      }),
    ).toBe(false);
  });
});
