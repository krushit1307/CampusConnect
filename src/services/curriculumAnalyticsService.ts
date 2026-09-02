/**
 * Enterprise Academic Curriculum & Course Credit Analytics Service
 * Provides telemetry on degree program credit completion, student graduation pacing,
 * department course load balancing, and accreditation compliance under ABET / NAAC standards.
 */

export const DEGREE_PROGRAM_TYPES = {
  BACHELOR_OF_SCIENCE: 'Bachelor of Science (B.S.)',
  BACHELOR_OF_ARTS: 'Bachelor of Arts (B.A.)',
  MASTER_OF_SCIENCE: 'Master of Science (M.S.)',
  DOCTOR_OF_PHILOSOPHY: 'Doctor of Philosophy (Ph.D.)',
};

export interface DepartmentCurriculumData {
  departmentId: string;
  departmentName: string;
  programType: string;
  totalRequiredCredits: number;
  coreCourseCreditsCompleted: number;
  electiveCreditsCompleted: number;
  labCreditsCompleted: number;
  enrolledStudentsCount: number;
  atRiskStudentsCount: number;
  evaluatedAt: string;
}

export interface CurriculumCreditEvaluation {
  totalEarnedCredits: number;
  creditCompletionRatioPercent: number;
  coreToElectiveRatio: number;
  isAccreditationCompliant: boolean;
  complianceStatus: 'FULL_COMPLIANCE' | 'MARGINAL_DEFICIT' | 'ACCREDITATION_WARNING';
}

export interface GraduationProgressMetrics {
  creditsRemaining: number;
  estimatedSemestersToGraduation: number;
  onTrackForGraduation: boolean;
}

export interface DepartmentRemediationPlan {
  departmentId: string;
  departmentName: string;
  atRiskStudentRatioPercent: number;
  recommendedFacultyAdvisorsToAssign: number;
  remediationDirectives: string[];
}

/**
 * Evaluates department curriculum credit distribution against degree requirements.
 */
export function evaluateCurriculumCreditDistribution(data: DepartmentCurriculumData): CurriculumCreditEvaluation {
  const totalEarned = data.coreCourseCreditsCompleted + data.electiveCreditsCompleted + data.labCreditsCompleted;
  const ratio = Math.round((totalEarned / data.totalRequiredCredits) * 100.0 * 10) / 10;
  const coreElectiveRatio = data.electiveCreditsCompleted > 0
    ? Math.round((data.coreCourseCreditsCompleted / data.electiveCreditsCompleted) * 10) / 10
    : 1.0;

  const compliant = ratio >= 80.0 && data.coreCourseCreditsCompleted >= 45;
  let status: CurriculumCreditEvaluation['complianceStatus'] = 'FULL_COMPLIANCE';

  if (!compliant) {
    status = ratio >= 65.0 ? 'MARGINAL_DEFICIT' : 'ACCREDITATION_WARNING';
  }

  return {
    totalEarnedCredits: totalEarned,
    creditCompletionRatioPercent: ratio,
    coreToElectiveRatio: coreElectiveRatio,
    isAccreditationCompliant: compliant,
    complianceStatus: status,
  };
}

/**
 * Calculates individual student graduation progress and remaining semester load.
 */
export function calculateStudentGraduationProgress(
  requiredCredits: number,
  completedCredits: number,
  averageCreditsPerSemester = 15
): GraduationProgressMetrics {
  const remaining = Math.max(0, requiredCredits - completedCredits);
  const semesters = Math.ceil(remaining / averageCreditsPerSemester);
  const onTrack = remaining <= 30;

  return {
    creditsRemaining: remaining,
    estimatedSemestersToGraduation: semesters,
    onTrackForGraduation: onTrack,
  };
}

/**
 * Generates academic department student advising and remediation plan for at-risk cohorts.
 */
export function generateAcademicDepartmentRemediationPlan(data: DepartmentCurriculumData): DepartmentRemediationPlan {
  const riskRatio = Math.round((data.atRiskStudentsCount / data.enrolledStudentsCount) * 100.0 * 10) / 10;
  const advisorsNeeded = Math.max(1, Math.ceil(data.atRiskStudentsCount / 15.0));

  const directives: string[] = [
    'Schedule mandatory 1-on-1 academic counseling for all students in deficit.',
    'Offer supplementary summer term tutorial blocks for high-failure core courses.',
    'Reallocate departmental lab assistants to peer-led study workshops.',
  ];

  if (riskRatio > 10.0) {
    directives.push('🚨 HIGH RISK WARNING: Exceeds 10% student academic risk threshold. Trigger Dean intervention review.');
  }

  return {
    departmentId: data.departmentId,
    departmentName: data.departmentName,
    atRiskStudentRatioPercent: riskRatio,
    recommendedFacultyAdvisorsToAssign: advisorsNeeded,
    remediationDirectives: directives,
  };
}
