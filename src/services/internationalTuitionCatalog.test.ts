/**
 * Unit Tests for International Tuition Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateInternationalTuitionSurcharge, INTERNATIONAL_TUITION_POLICIES } from './internationalTuitionCatalog';

describe('InternationalTuitionCatalog', () => {
  it('should calculate international tuition surcharge percentage correctly', () => {
    const surcharge = calculateInternationalTuitionSurcharge(20000, 'North America / EU');
    expect(surcharge).toBe(5000);
  });

  it('should contain catalog of international tuition fee policies', () => {
    expect(INTERNATIONAL_TUITION_POLICIES.length).toBeGreaterThanOrEqual(3);
  });
});
