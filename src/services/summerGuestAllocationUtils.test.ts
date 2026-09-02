/**
 * Unit Tests for Summer Guest Allocation Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateSummerGuestAllocation } from './summerGuestAllocationUtils';

describe('SummerGuestAllocationUtils', () => {
  it('should calculate summer guest suite allocations and revenue telemetry', () => {
    const res = calculateSummerGuestAllocation(50, 40, 90.0, 4);
    expect(res.totalGuestSuitesAllocated).toBe(40);
    expect(res.revenueGeneratedUSD).toBe(14400.0);
    expect(res.isOverbookingRisk).toBe(false);
  });
});
