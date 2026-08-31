/**
 * Work-Study Student Hourly Payroll & Stipend Calculation Utilities
 */

export interface WorkStudyPayrollMetrics {
  totalGrossPayUSD: number;
  remainingAwardBalanceUSD: number;
  isMaxHoursExceeded: boolean;
}

/**
 * Calculates work-study student payroll earnings and remaining award balance.
 */
export function calculateWorkStudyPayroll(
  hourlyRateUSD: number,
  hoursWorked: number,
  totalApprovedAwardUSD: number,
  maxHoursPerWeek = 20
): WorkStudyPayrollMetrics {
  const grossPay = Math.round(hourlyRateUSD * hoursWorked * 100) / 100;
  const remaining = Math.max(0, totalApprovedAwardUSD - grossPay);
  const exceeded = hoursWorked > maxHoursPerWeek;

  return {
    totalGrossPayUSD: grossPay,
    remainingAwardBalanceUSD: remaining,
    isMaxHoursExceeded: exceeded,
  };
}
