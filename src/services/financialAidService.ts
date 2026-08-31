/**
 * Student Financial Aid & Merit-Based Scholarship Allocation Service
 * Evaluates student need-based grants, merit scholarship tiers, endowment fund disbursements,
 * and federal/state educational financial compliance audits under Title IV standards.
 */

export const SCHOLARSHIP_TIER_TYPES = {
  PRESIDENTIAL_MERIT: 'Presidential Merit Honor Scholarship',
  DEAN_ACADEMIC_EXCELLENCE: 'Dean Academic Excellence Grant',
  NEED_AND_MERIT_COMBINED: 'Need & Merit Combined Tuition Support',
  WORK_STUDY_ASSISTANTSHIP: 'Campus Work-Study Fellowship',
};

export interface StudentAidApplicationData {
  applicationId: string;
  studentId: string;
  studentName: string;
  cumulativeGpa: number;
  annualFamilyIncomeUSD: number;
  tuitionFeeUSD: number;
  requestedScholarshipTier: string;
  appliedAt: string;
}

export interface AidEligibilityResult {
  isEligible: boolean;
  approvalTier: 'FULL_SCHOLARSHIP_GRANT' | 'PARTIAL_50_PERCENT_GRANT' | 'WORK_STUDY_ONLY' | 'APPLICATION_REJECTED';
  financialNeedScore: number; // 0 to 100
  meritScore: number;         // 0 to 100
}

export interface ScholarshipDisbursement {
  tuitionFeeUSD: number;
  disbursementAmountUSD: number;
  remainingStudentTuitionUSD: number;
  coverageRatioPercent: number;
}

export interface FinancialAidComplianceReport {
  applicationId: string;
  studentName: string;
  complianceStatus: 'AUDIT_PASSED_VERIFIED' | 'ADDITIONAL_INCOME_PROOF_REQUIRED' | 'TITLE_IV_EXCEEDED';
  complianceDirectives: string[];
}

/**
 * Evaluates student financial aid eligibility and assigned scholarship grant tier.
 */
export function evaluateFinancialAidEligibility(data: StudentAidApplicationData): AidEligibilityResult {
  const merit = Math.min(100, Math.round((data.cumulativeGpa / 4.0) * 100.0));

  let need = 0;
  if (data.annualFamilyIncomeUSD < 30000) need = 95;
  else if (data.annualFamilyIncomeUSD < 50000) need = 75;
  else if (data.annualFamilyIncomeUSD < 80000) need = 45;
  else need = 15;

  const eligible = data.cumulativeGpa >= 2.5 && need >= 30;
  let tier: AidEligibilityResult['approvalTier'] = 'APPLICATION_REJECTED';

  if (eligible) {
    if (data.cumulativeGpa >= 3.8 && need >= 70) {
      tier = 'FULL_SCHOLARSHIP_GRANT';
    } else if (data.cumulativeGpa >= 3.0 || need >= 50) {
      tier = 'PARTIAL_50_PERCENT_GRANT';
    } else {
      tier = 'WORK_STUDY_ONLY';
    }
  }

  return {
    isEligible: eligible,
    approvalTier: tier,
    financialNeedScore: need,
    meritScore: merit,
  };
}

/**
 * Calculates net financial aid dollar disbursement and remaining tuition balance.
 */
export function calculateScholarshipDisbursementAmount(
  tuitionFeeUSD: number,
  gpa: number,
  familyIncomeUSD: number
): ScholarshipDisbursement {
  let coverageFraction = 0.25;

  if (gpa >= 3.8 && familyIncomeUSD < 45000) {
    coverageFraction = 0.85; // 85% grant coverage
  } else if (gpa >= 3.4 || familyIncomeUSD < 60000) {
    coverageFraction = 0.50; // 50% grant coverage
  }

  const disbursement = Math.round(tuitionFeeUSD * coverageFraction);
  const remaining = Math.max(0, tuitionFeeUSD - disbursement);
  const coveragePercent = Math.round(coverageFraction * 100.0);

  return {
    tuitionFeeUSD,
    disbursementAmountUSD: disbursement,
    remainingStudentTuitionUSD: remaining,
    coverageRatioPercent: coveragePercent,
  };
}

/**
 * Generates financial aid audit compliance report for board certification.
 */
export function generateFinancialAidComplianceReport(data: StudentAidApplicationData): FinancialAidComplianceReport {
  const directives: string[] = [
    'Verify FAFSA / tax returns against IRS data retrieval tool.',
    'Confirm candidate maintains Satisfactory Academic Progress (SAP >= 2.0 GPA).',
    'Disburse funds directly to university bursar account.',
  ];

  let status: FinancialAidComplianceReport['complianceStatus'] = 'AUDIT_PASSED_VERIFIED';

  if (data.annualFamilyIncomeUSD > 150000) {
    status = 'ADDITIONAL_INCOME_PROOF_REQUIRED';
    directives.push('⚠️ Income exceeds standard aid threshold. Verification documents required.');
  }

  return {
    applicationId: data.applicationId,
    studentName: data.studentName,
    complianceStatus: status,
    complianceDirectives: directives,
  };
}
