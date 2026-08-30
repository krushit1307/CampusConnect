/**
 * Unit Tests for Outdoor Gear Rental Utilities
 */

import { describe, it, expect } from 'vitest';
import { rentOutdoorRecreationGear } from './outdoorGearRentalUtils';

describe('OutdoorGearRentalUtils', () => {
  it('should calculate discounted gear rental rate for outdoor club members', () => {
    const res = rentOutdoorRecreationGear('4-Person Camping Tent', true);
    expect(res.rentalId).toContain('RENT-GEAR-');
    expect(res.dailyRateUSD).toBe(12.50);
    expect(res.isDepositWaived).toBe(true);
  });
});
