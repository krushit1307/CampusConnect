/**
 * Course Equivalent Credit Transfer & Prerequisite Verification Utilities
 */

export interface PrerequisiteCheckResult {
  prerequisitesMet: boolean;
  missingPrerequisiteCourseIds: string[];
  eligibleForOverride: boolean;
}

/**
 * Verifies if student course transcript satisfies prerequisite requirements.
 */
export function checkCoursePrerequisites(
  studentCompletedCourseIds: string[],
  requiredPrerequisiteIds: string[],
  studentGpa: number
): PrerequisiteCheckResult {
  const missing = requiredPrerequisiteIds.filter(id => !studentCompletedCourseIds.includes(id));
  const met = missing.length === 0;
  const override = !met && studentGpa >= 3.5 && missing.length === 1;

  return {
    prerequisitesMet: met,
    missingPrerequisiteCourseIds: missing,
    eligibleForOverride: override,
  };
}
