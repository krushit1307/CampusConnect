import { describe, it, expect } from "vitest";
import {
  calculateInstallmentSchedule,
  processSuccessfulInstallmentPayment,
  processFailedInstallmentPayment,
  PaymentPlanRecord,
} from "./clubDuesPaymentPlans";

describe("Dynamic Club Dues Payment Plan Scheduler Suite (#3671)", () => {
  const samplePlan: PaymentPlanRecord = {
    id: "plan_101",
    clubId: "club_ski",
    userId: "usr_skier",
    stripeSubscriptionId: "sub_stripe_8829",
    totalAmount: 300.0,
    installmentAmount: 50.0,
    totalInstallments: 6,
    completedInstallments: 0,
    status: "ACTIVE",
  };

  it("calculates monthly installment breakdown accurately", () => {
    const schedule = calculateInstallmentSchedule({
      totalDuesAmount: 300.0,
      installmentCount: 6,
    });

    expect(schedule.installmentAmount).toBe(50.0);
    expect(schedule.installmentCount).toBe(6);
    expect(schedule.interval).toBe("month");
  });

  it("increments completed installments and transitions state to COMPLETED on final iteration", () => {
    const initialRes = processSuccessfulInstallmentPayment(samplePlan);
    expect(initialRes.updatedPlan.completedInstallments).toBe(1);
    expect(initialRes.isFullyPaid).toBe(false);

    const nearCompletePlan: PaymentPlanRecord = { ...samplePlan, completedInstallments: 5 };
    const finalRes = processSuccessfulInstallmentPayment(nearCompletePlan);
    expect(finalRes.updatedPlan.completedInstallments).toBe(6);
    expect(finalRes.isFullyPaid).toBe(true);
    expect(finalRes.updatedPlan.status).toBe("COMPLETED");
  });

  it("handles payment failures by updating status to PAST_DUE and generating dunning email", () => {
    const failureRes = processFailedInstallmentPayment(
      samplePlan,
      "student@university.edu",
      "Ski Team",
    );

    expect(failureRes.updatedPlan.status).toBe("PAST_DUE");
    expect(failureRes.dunningEmailPayload.subject).toContain("Payment Failed");
    expect(failureRes.dunningEmailPayload.bodyHtml).toContain("Ski Team");
  });
});
