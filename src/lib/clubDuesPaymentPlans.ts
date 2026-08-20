export interface PaymentPlanConfig {
  totalDuesAmount: number;
  installmentCount: number;
}

export interface CalculatedInstallmentSchedule {
  totalAmount: number;
  installmentAmount: number;
  installmentCount: number;
  interval: "month";
}

export interface PaymentPlanRecord {
  id: string;
  clubId: string;
  userId: string;
  stripeSubscriptionId: string;
  totalAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  completedInstallments: number;
  status: "ACTIVE" | "COMPLETED" | "PAST_DUE" | "CANCELED";
}

/**
 * Calculates installment breakdown schedule from total dues amount and installment count.
 */
export function calculateInstallmentSchedule(
  config: PaymentPlanConfig,
): CalculatedInstallmentSchedule {
  if (config.totalDuesAmount <= 0 || config.installmentCount <= 0) {
    throw new Error("Invalid dues amount or installment count.");
  }

  const installmentAmount = Number((config.totalDuesAmount / config.installmentCount).toFixed(2));

  return {
    totalAmount: config.totalDuesAmount,
    installmentAmount,
    installmentCount: config.installmentCount,
    interval: "month",
  };
}

/**
 * Handles Stripe invoice payment succeeded webhook event, incrementing completed iterations and marking plan completed if finished.
 */
export function processSuccessfulInstallmentPayment(plan: PaymentPlanRecord): {
  updatedPlan: PaymentPlanRecord;
  isFullyPaid: boolean;
} {
  const nextCompleted = plan.completedInstallments + 1;
  const isFullyPaid = nextCompleted >= plan.totalInstallments;

  const updatedPlan: PaymentPlanRecord = {
    ...plan,
    completedInstallments: nextCompleted,
    status: isFullyPaid ? "COMPLETED" : "ACTIVE",
  };

  return { updatedPlan, isFullyPaid };
}

/**
 * Handles Stripe invoice payment failure webhook event, revoking paid member status and generating dunning notice.
 */
export function processFailedInstallmentPayment(
  plan: PaymentPlanRecord,
  userEmail: string,
  clubName: string,
): { updatedPlan: PaymentPlanRecord; dunningEmailPayload: { subject: string; bodyHtml: string } } {
  const updatedPlan: PaymentPlanRecord = {
    ...plan,
    status: "PAST_DUE",
  };

  const subject = `Payment Failed: Action Required for Your ${clubName} Membership`;
  const bodyHtml = `
    <h2>Important Notice Regarding Your ${clubName} Dues</h2>
    <p>We were unable to process your scheduled installment payment of <strong>$${plan.installmentAmount.toFixed(2)}</strong>.</p>
    <p>Your paid member status has been temporarily suspended until payment information is updated.</p>
    <p><a href="https://campusconnect.edu/account/billing">Update Payment Method</a></p>
  `.trim();

  return {
    updatedPlan,
    dunningEmailPayload: { subject, bodyHtml },
  };
}
