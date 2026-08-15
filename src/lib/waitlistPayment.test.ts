import { describe, it, expect } from "vitest";
import {
  promoteWaitlistedUser,
  isPaymentDeadlineExpired,
  processExpiredReservations,
  confirmPaymentRsvp,
  PAYMENT_WINDOW_MS,
  GRACE_PERIOD_MS,
  WaitlistRsvpRecord,
} from "./waitlistPayment";

describe("Waitlist-to-Payment Pipeline Suite (#2726)", () => {
  const baseTime = 1000000000000;

  const sampleWaitlistRecord: WaitlistRsvpRecord = {
    id: "rsvp_1001",
    eventId: "evt_paid_party",
    userId: "usr_alice",
    status: "waitlisted",
  };

  it("promotes waitlisted user to pending_payment with strict 15-minute deadline", () => {
    const promoted = promoteWaitlistedUser(sampleWaitlistRecord, baseTime);

    expect(promoted.status).toBe("pending_payment");
    expect(promoted.paymentDeadline).toBe(baseTime + PAYMENT_WINDOW_MS);
  });

  it("evaluates deadline expiration accurately including webhook grace period", () => {
    const promoted = promoteWaitlistedUser(sampleWaitlistRecord, baseTime);

    // 10 minutes elapsed -> Not expired
    expect(isPaymentDeadlineExpired(promoted, baseTime + 10 * 60 * 1000)).toBe(false);

    // 16 minutes elapsed -> Expired strictly
    expect(isPaymentDeadlineExpired(promoted, baseTime + 16 * 60 * 1000)).toBe(true);

    // 16 minutes elapsed with grace period -> Not expired yet
    expect(isPaymentDeadlineExpired(promoted, baseTime + 16 * 60 * 1000, true)).toBe(false);
  });

  it("sweeps expired reservations and confirms paid RSVPs", () => {
    const promoted = promoteWaitlistedUser(sampleWaitlistRecord, baseTime);

    // Sweep after 20 minutes
    const sweep = processExpiredReservations([promoted], baseTime + 20 * 60 * 1000);
    expect(sweep.expiredRsvpIds).toContain("rsvp_1001");
    expect(sweep.activeRecords[0].status).toBe("cancelled");

    // Successful payment confirmation
    const paid = confirmPaymentRsvp(promoted);
    expect(paid.status).toBe("attending");
    expect(paid.paymentDeadline).toBeUndefined();
  });
});
