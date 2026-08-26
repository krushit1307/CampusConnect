export interface WaitlistRsvpRecord {
  id: string;
  eventId: string;
  userId: string;
  status: "waitlisted" | "pending_payment" | "attending" | "cancelled";
  paymentDeadline?: number; // Unix timestamp in ms
}

export const PAYMENT_WINDOW_MS = 15 * 60 * 1000; // 15 Minutes
export const GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 Minute Grace Period for Webhooks

/**
 * Promotes a waitlisted user record into pending_payment with a 15-minute deadline.
 */
export function promoteWaitlistedUser(
  record: WaitlistRsvpRecord,
  nowMs: number = Date.now(),
): WaitlistRsvpRecord {
  return {
    ...record,
    status: "pending_payment",
    paymentDeadline: nowMs + PAYMENT_WINDOW_MS,
  };
}

/**
 * Checks if a pending payment deadline has passed (including grace period allowance).
 */
export function isPaymentDeadlineExpired(
  record: WaitlistRsvpRecord,
  nowMs: number = Date.now(),
  includeGracePeriod = false,
): boolean {
  if (record.status !== "pending_payment" || !record.paymentDeadline) {
    return false;
  }

  const deadline = includeGracePeriod
    ? record.paymentDeadline + GRACE_PERIOD_MS
    : record.paymentDeadline;

  return nowMs >= deadline;
}

/**
 * Sweeps expired pending_payment RSVPs, demoting them back to waitlisted/cancelled.
 */
export function processExpiredReservations(
  records: WaitlistRsvpRecord[],
  nowMs: number = Date.now(),
): {
  activeRecords: WaitlistRsvpRecord[];
  expiredRsvpIds: string[];
} {
  const expiredRsvpIds: string[] = [];

  const activeRecords = records.map((rec) => {
    if (isPaymentDeadlineExpired(rec, nowMs)) {
      expiredRsvpIds.push(rec.id);
      return {
        ...rec,
        status: "cancelled" as const,
        paymentDeadline: undefined,
      };
    }
    return rec;
  });

  return { activeRecords, expiredRsvpIds };
}

/**
 * Finalizes RSVP payment confirmation from Stripe webhook.
 */
export function confirmPaymentRsvp(record: WaitlistRsvpRecord): WaitlistRsvpRecord {
  return {
    ...record,
    status: "attending",
    paymentDeadline: undefined,
  };
}
