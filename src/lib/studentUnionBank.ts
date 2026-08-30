/**
 * Student Union Bank — Point Loan calculations (#4840)
 * Pure, testable functions for the "Resource Constraint" loan system.
 */

export const LOAN_ELIGIBILITY_THRESHOLD_POINTS = 100;
export const LOAN_PRINCIPAL_POINTS = 1000;
export const LOAN_INTEREST_RATE = 0.1;
export const LOAN_TOTAL_OWED_POINTS = Math.round(
  LOAN_PRINCIPAL_POINTS * (1 + LOAN_INTEREST_RATE),
);
export const GARNISHMENT_RATE = 0.5;
export const GARNISHMENT_DURATION_MONTHS = 3;

export interface PointLoan {
  id: string;
  clubId: string;
  principalPoints: number;
  totalOwedPoints: number;
  amountRepaidPoints: number;
  status: "active" | "repaid" | "garnishment_expired";
  issuedAt: string;
  garnishmentExpiresAt: string;
}

/** A club qualifies only if its ledger balance is under the threshold and it has no active loan. */
export function isEligibleForPointLoan(
  clubLedgerBalance: number,
  hasActiveLoan: boolean,
): { eligible: boolean; reason?: string } {
  if (hasActiveLoan) {
    return { eligible: false, reason: "Club already has an active point loan." };
  }
  if (clubLedgerBalance >= LOAN_ELIGIBILITY_THRESHOLD_POINTS) {
    return {
      eligible: false,
      reason: `Club must have fewer than ${LOAN_ELIGIBILITY_THRESHOLD_POINTS} points to qualify.`,
    };
  }
  return { eligible: true };
}

/** Computes the loan terms: 1,000 locked points, 10% interest, -1,100 owed. */
export function calculateLoanTerms(principal: number = LOAN_PRINCIPAL_POINTS) {
  const interest = Math.round(principal * LOAN_INTEREST_RATE);
  return {
    principalPoints: principal,
    interestPoints: interest,
    totalOwedPoints: principal + interest,
  };
}

/** Whether the 3-month garnishment window is still open. */
export function isGarnishmentActive(garnishmentExpiresAtIso: string, now: Date = new Date()): boolean {
  return now.getTime() < new Date(garnishmentExpiresAtIso).getTime();
}

/** Splits newly earned points 50/50 between the club and loan repayment. */
export function calculateGarnishment(
  grossPointsEarned: number,
  remainingOwedPoints: number,
  garnishmentRate: number = GARNISHMENT_RATE,
): { garnishedAmount: number; netAmountToClub: number; remainingOwedAfter: number } {
  if (grossPointsEarned <= 0 || remainingOwedPoints <= 0) {
    return { garnishedAmount: 0, netAmountToClub: grossPointsEarned, remainingOwedAfter: Math.max(0, remainingOwedPoints) };
  }

  const rawGarnish = Math.floor(grossPointsEarned * garnishmentRate);
  const garnishedAmount = Math.min(rawGarnish, remainingOwedPoints);

  return {
    garnishedAmount,
    netAmountToClub: grossPointsEarned - garnishedAmount,
    remainingOwedAfter: remainingOwedPoints - garnishedAmount,
  };
}