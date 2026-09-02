/**
 * Unit Tests for Course Prerequisite Verification Utilities
 */

import { describe, it, expect } from 'vitest';
import { checkCoursePrerequisites } from './coursePrerequisiteUtils';

describe('CoursePrerequisiteUtils', () => {
  it('should verify when all prerequisite courses are completed', () => {
    const res = checkCoursePrerequisites(['CS101', 'CS102'], ['CS101'], 3.2);
    expect(res.prerequisitesMet).toBe(true);
    expect(res.missingPrerequisiteCourseIds.length).toBe(0);
  });

  it('should allow prerequisite override for high-GPA students missing single course', () => {
    const res = checkCoursePrerequisites(['CS101'], ['CS101', 'MATH201'], 3.7);
    expect(res.prerequisitesMet).toBe(false);
    expect(res.eligibleForOverride).toBe(true);
  });
});
