/**
 * Enterprise Academic Curriculum & Course Credit Analytics Service Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateCurriculumCreditDistribution,
  calculateStudentGraduationProgress,
  generateAcademicDepartmentRemediationPlan,
  DEGREE_PROGRAM_TYPES,
} from './curriculumAnalyticsService';

describe('CurriculumAnalyticsService', () => {
  const sampleDepartment = {
    departmentId: 'DEPT-CS-2026',
    departmentName: 'Department of Computer Science & Artificial Intelligence',
    programType: DEGREE_PROGRAM_TYPES.BACHELOR_OF_SCIENCE,
    totalRequiredCredits: 120,
    coreCourseCreditsCompleted: 54,
    electiveCreditsCompleted: 30,
    labCreditsCompleted: 18,
    enrolledStudentsCount: 450,
    atRiskStudentsCount: 38,
    evaluatedAt: '2026-08-30T10:00:00Z',
  };

  it('should evaluate curriculum credit distribution and degree accreditation compliance', () => {
    const evaluation = evaluateCurriculumCreditDistribution(sampleDepartment);

    expect(evaluation).toBeDefined();
    expect(evaluation.totalEarnedCredits).toBe(102);
    expect(evaluation.creditCompletionRatioPercent).toBeCloseTo(85.0, 1);
    expect(evaluation.isAccreditationCompliant).toBe(true);
  });

  it('should calculate student graduation progress and credit deficit', () => {
    const progress = calculateStudentGraduationProgress(
      sampleDepartment.totalRequiredCredits,
      sampleDepartment.coreCourseCreditsCompleted + sampleDepartment.electiveCreditsCompleted + sampleDepartment.labCreditsCompleted
    );

    expect(progress).toBeDefined();
    expect(progress.creditsRemaining).toBe(18);
    expect(progress.estimatedSemestersToGraduation).toBe(1);
    expect(progress.onTrackForGraduation).toBe(true);
  });

  it('should generate academic department remediation & faculty allocation plan', () => {
    const plan = generateAcademicDepartmentRemediationPlan(sampleDepartment);

    expect(plan).toBeDefined();
    expect(plan.departmentId).toBe('DEPT-CS-2026');
    expect(plan.atRiskStudentRatioPercent).toBeCloseTo(8.4, 1);
    expect(plan.remediationDirectives.length).toBeGreaterThanOrEqual(3);
  });
});
