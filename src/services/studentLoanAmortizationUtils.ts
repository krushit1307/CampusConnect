/**
 * Educational Student Loan Repayment & Interest Amortization Utilities
 */

export interface LoanAmortizationSchedule {
  monthlyPaymentUSD: number;
  totalInterestPaidUSD: number;
  payoffDurationMonths: number;
}

/**
 * Calculates monthly student loan payment and total interest under standard 10-year amortization.
 */
export function calculateStudentLoanAmortization(
  principalLoanUSD: number,
  annualInterestRatePercent = 4.99,
  termYears = 10
): LoanAmortizationSchedule {
  const r = (annualInterestRatePercent / 100.0) / 12.0;
  const n = termYears * 12;

  const monthly = Math.round((principalLoanUSD * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1) * 100) / 100;
  const totalPaid = monthly * n;
  const totalInterest = Math.round((totalPaid - principalLoanUSD) * 100) / 100;

  return {
    monthlyPaymentUSD: monthly,
    totalInterestPaidUSD: totalInterest,
    payoffDurationMonths: n,
  };
}
