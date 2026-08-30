/**
 * Unit Tests for Roommate Compatibility Calculator Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateRoommateCompatibility } from './roommateCompatibilityUtils';

describe('RoommateCompatibilityUtils', () => {
  it('should calculate high roommate compatibility score for aligned lifestyle habits', () => {
    const res = calculateRoommateCompatibility(0, 0, 1);
    expect(res.compatibilityScorePercent).toBeGreaterThanOrEqual(90);
    expect(res.compatibilityRating).toBe('HIGHLY_COMPATIBLE');
  });
});
