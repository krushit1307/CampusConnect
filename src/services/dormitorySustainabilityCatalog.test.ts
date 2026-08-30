/**
 * Unit Tests for Dormitory Sustainability Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateDormitoryEnergyRating, DORMITORY_SUSTAINABILITY_CATALOG } from './dormitorySustainabilityCatalog';

describe('DormitorySustainabilityCatalog', () => {
  it('should calculate eco excellence rating for low kWh energy consumption', () => {
    const rating = calculateDormitoryEnergyRating(115.0);
    expect(rating).toBe('ECO_EXCELLENCE');
  });

  it('should contain catalog of LEED-certified dormitory buildings', () => {
    expect(DORMITORY_SUSTAINABILITY_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
});
