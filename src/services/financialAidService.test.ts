/**
 * Student Financial Aid & Merit-Based Scholarship Allocation Service Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateFinancialAidEligibility,
  calculateScholarshipDisbursementAmount,
  generateFinancialAidComplianceReport,
  SCHOLARSHIP_TIER_TYPES,
} from './financialAidService';

describe('FinancialAidService', () => {
  const sampleStudent = {
    applicationId: 'AID-2026-901',
    studentId: 'STU-8821',
    studentName: 'Eleanor Vance',
    cumulativeGpa: 3.85,
    annualFamilyIncomeUSD: 38000,
    tuitionFeeUSD: 18000,
    requestedScholarshipTier: SCHOLARSHIP_TIER_TYPES.NEED_AND_MERIT_COMBINED,
    appliedAt: '2026-08-30T10:00:00Z',
  };

  it('should evaluate financial aid eligibility based on GPA and family income', () => {
    const eligibility = evaluateFinancialAidEligibility(sampleStudent);

    expect(eligibility).toBeDefined();
    expect(eligibility.isEligible).toBe(true);
    expect(eligibility.approvalTier).toBe('FULL_SCHOLARSHIP_GRANT');
    expect(eligibility.financialNeedScore).toBeGreaterThan(70.0);
  });

  it('should calculate net scholarship disbursement amount and remaining tuition liability', () => {
    const disbursement = calculateScholarshipDisbursementAmount(
      sampleStudent.tuitionFeeUSD,
      sampleStudent.cumulativeGpa,
      sampleStudent.annualFamilyIncomeUSD
    );

    expect(disbursement).toBeDefined();
    expect(disbursement.disbursementAmountUSD).toBeGreaterThan(10000);
    expect(disbursement.remainingStudentTuitionUSD).toBeLessThan(8000);
  });

  it('should generate financial aid compliance audit report for university endowment board', () => {
    const report = generateFinancialAidComplianceReport(sampleStudent);

    expect(report).toBeDefined();
    expect(report.applicationId).toBe('AID-2026-901');
    expect(report.complianceStatus).toBe('AUDIT_PASSED_VERIFIED');
    expect(report.complianceDirectives.length).toBeGreaterThanOrEqual(3);
  });
});
