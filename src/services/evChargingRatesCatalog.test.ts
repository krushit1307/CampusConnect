/**
 * Unit Tests for EV Charging Rates Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateEvChargingSessionCost, EV_CHARGING_RATES_CATALOG } from './evChargingRatesCatalog';

describe('EvChargingRatesCatalog', () => {
  it('should calculate EV charging session total cost correctly', () => {
    const cost = calculateEvChargingSessionCost(40.0, 'EV-STATION-NORTH-1');
    expect(cost).toBe(7.20);
  });

  it('should contain catalog of campus EV charging stations', () => {
    expect(EV_CHARGING_RATES_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
});
