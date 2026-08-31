/**
 * Unit Tests for Parking Structure Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateParkingStructureOccupancy } from './parkingStructureUtils';

describe('ParkingStructureUtils', () => {
  it('should calculate available parking spaces and EV charging spots', () => {
    const res = calculateParkingStructureOccupancy(500, 420, 20, 12);
    expect(res.availablePermitSpaces).toBe(80);
    expect(res.availableEvChargingSpots).toBe(8);
    expect(res.isGarageFull).toBe(false);
  });
});
