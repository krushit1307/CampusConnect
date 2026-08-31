/**
 * Unit Tests for Faculty Research Productivity Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateFacultyResearchProductivity } from './facultyResearchUtils';

describe('FacultyResearchUtils', () => {
  it('should calculate publications per faculty and grant funding ratio', () => {
    const res = calculateFacultyResearchProductivity(45, 500000, 15);
    expect(res.publicationsPerFaculty).toBe(3.0);
    expect(res.grantFundingPerFacultyUSD).toBeGreaterThan(30000);
  });
});
