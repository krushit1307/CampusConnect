/**
 * Unit Tests for Student Loan Amortization Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateStudentLoanAmortization } from './studentLoanAmortizationUtils';

describe('StudentLoanAmortizationUtils', () => {
  it('should calculate monthly payment and total interest under 10-year loan amortization', () => {
    const res = calculateStudentLoanAmortization(20000, 5.0, 10);
    expect(res.monthlyPaymentUSD).toBeGreaterThan(200);
    expect(res.payoffDurationMonths).toBe(120);
  });
});
