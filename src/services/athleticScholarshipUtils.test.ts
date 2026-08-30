/**
 * Unit Tests for Athletic Scholarship Utilities
 */

import { describe, it, expect } from 'vitest';
import { evaluateAthleticScholarshipEligibility } from './athleticScholarshipUtils';

describe('AthleticScholarshipUtils', () => {
  it('should verify NCAA eligibility and approve full athletic scholarship for high-performing student athletes', () => {
    const res = evaluateAthleticScholarshipEligibility(3.2, 30, 15000);
    expect(res.approvedScholarshipUSD).toBe(15000);
    expect(res.ncaaEligibilityStatus).toBe('ELIGIBLE_ACTIVE');
  });
});
