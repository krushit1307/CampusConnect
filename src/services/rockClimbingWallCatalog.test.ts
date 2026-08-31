/**
 * Unit Tests for Rock Climbing Wall Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { validateBelayCertification, ROCK_CLIMBING_WALL_BELAY_CATALOG } from './rockClimbingWallCatalog';

describe('RockClimbingWallCatalog', () => {
  it('should validate student belay safety certification correctly', () => {
    const isCertified = validateBelayCertification('STU-4401');
    expect(isCertified).toBe(true);
  });

  it('should contain catalog of student climbing wall safety certifications', () => {
    expect(ROCK_CLIMBING_WALL_BELAY_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
});
