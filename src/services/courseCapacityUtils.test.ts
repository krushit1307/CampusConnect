/**
 * Unit Tests for Course Capacity Optimization Utilities
 */

import { describe, it, expect } from 'vitest';
import { optimizeCourseSectionCapacity } from './courseCapacityUtils';

describe('CourseCapacityUtils', () => {
  it('should calculate optimal course sections count and faculty workload hours', () => {
    const res = optimizeCourseSectionCapacity(100, 35, 3);
    expect(res.recommendedSectionsCount).toBe(3);
    expect(res.facultyWorkloadHours).toBe(9);
  });
});
