/**
 * Academic Department Course Capacity & Section Load Optimization Utilities
 */

export interface SectionLoadResult {
  recommendedSectionsCount: number;
  averageClassSize: number;
  facultyWorkloadHours: number;
}

/**
 * Calculates optimal course sections count and faculty teaching load.
 */
export function optimizeCourseSectionCapacity(
  totalEnrolledStudents: number,
  maxClassCapacity = 35,
  creditsPerCourse = 3
): SectionLoadResult {
  const sections = Math.max(1, Math.ceil(totalEnrolledStudents / maxClassCapacity));
  const avgSize = Math.round((totalEnrolledStudents / sections) * 10) / 10;
  const facultyHours = sections * creditsPerCourse;

  return {
    recommendedSectionsCount: sections,
    averageClassSize: avgSize,
    facultyWorkloadHours: facultyHours,
  };
}
