/**
 * Student Academic Probation & GPA Telemetry Utilities
 */

export interface AcademicProbationStatus {
  isProbationWarningTriggered: boolean;
  probationCategory: 'GOOD_STANDING' | 'ACADEMIC_WARNING' | 'STRICT_PROBATION' | 'ACADEMIC_DISMISSAL';
  minimumGpaRequiredForNextSemester: number;
}

/**
 * Evaluates student cumulative GPA to determine academic standing and probation risk.
 */
export function evaluateAcademicProbationRisk(cumulativeGpa: number, semesterUnitsCompleted: number): AcademicProbationStatus {
  let category: AcademicProbationStatus['probationCategory'] = 'GOOD_STANDING';
  let warning = false;
  let minGpaNext = 2.0;

  if (cumulativeGpa < 1.5) {
    category = 'ACADEMIC_DISMISSAL';
    warning = true;
    minGpaNext = 2.5;
  } else if (cumulativeGpa < 2.0) {
    category = 'STRICT_PROBATION';
    warning = true;
    minGpaNext = 2.3;
  } else if (cumulativeGpa < 2.3) {
    category = 'ACADEMIC_WARNING';
    warning = true;
    minGpaNext = 2.1;
  }

  return {
    isProbationWarningTriggered: warning,
    probationCategory: category,
    minimumGpaRequiredForNextSemester: minGpaNext,
  };
}
