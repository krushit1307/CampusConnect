/**
 * University Athletic Scholarship & NCAA Compliance Telemetry Utilities
 */

export interface AthleticScholarshipMetrics {
  approvedScholarshipUSD: number;
  ncaaEligibilityStatus: 'ELIGIBLE_ACTIVE' | 'ACADEMIC_PROBATION_WARNING' | 'INELIGIBLE';
}

/**
 * Evaluates student athlete GPA and credit hours for NCAA scholarship eligibility.
 */
export function evaluateAthleticScholarshipEligibility(
  gpa: number,
  creditsCompletedThisYear: number,
  scholarshipCapUSD: number
): AthleticScholarshipMetrics {
  let status: AthleticScholarshipMetrics['ncaaEligibilityStatus'] = 'ELIGIBLE_ACTIVE';
  let grant = scholarshipCapUSD;

  if (gpa < 2.0 || creditsCompletedThisYear < 24) {
    status = 'INELIGIBLE';
    grant = 0;
  } else if (gpa < 2.3) {
    status = 'ACADEMIC_PROBATION_WARNING';
    grant = Math.round(scholarshipCapUSD * 0.5);
  }

  return {
    approvedScholarshipUSD: grant,
    ncaaEligibilityStatus: status,
  };
}
