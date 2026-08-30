/**
 * Unit Tests for Work-Study Payroll Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateWorkStudyPayroll } from './workStudyPayrollUtils';

describe('WorkStudyPayrollUtils', () => {
  it('should calculate work-study gross pay and remaining award balance', () => {
    const res = calculateWorkStudyPayroll(16.50, 15, 3000, 20);
    expect(res.totalGrossPayUSD).toBe(247.50);
    expect(res.remainingAwardBalanceUSD).toBe(2752.50);
    expect(res.isMaxHoursExceeded).toBe(false);
  });
});
