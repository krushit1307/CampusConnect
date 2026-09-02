/**
 * Unit Tests for Academic Probation Utilities
 */

import { describe, it, expect } from 'vitest';
import { evaluateAcademicProbationRisk } from './academicProbationUtils';

describe('AcademicProbationUtils', () => {
  it('should flag strict probation when GPA drops below 2.0', () => {
    const res = evaluateAcademicProbationRisk(1.85, 45);
    expect(res.isProbationWarningTriggered).toBe(true);
    expect(res.probationCategory).toBe('STRICT_PROBATION');
  });
});
