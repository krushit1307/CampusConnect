/**
 * Unit Tests for Aquatic Center Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { validatePoolWaterPhSafety, AQUATIC_CENTER_WATER_QUALITY_CATALOG } from './aquaticCenterCatalog';

describe('AquaticCenterCatalog', () => {
  it('should validate swimming pool water pH safety standards correctly', () => {
    const isSafe = validatePoolWaterPhSafety('Olympic Competition Pool');
    expect(isSafe).toBe(true);
  });

  it('should contain catalog of aquatic center pools', () => {
    expect(AQUATIC_CENTER_WATER_QUALITY_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
});
