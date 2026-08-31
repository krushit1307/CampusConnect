/**
 * Campus Housing Summer Conference & Visitor Guest Allocation Utilities
 */

export interface SummerGuestAllocationMetrics {
  totalGuestSuitesAllocated: number;
  revenueGeneratedUSD: number;
  isOverbookingRisk: boolean;
}

/**
 * Calculates summer guest suite allocations and revenue telemetry.
 */
export function calculateSummerGuestAllocation(
  availableSuitesCount: number,
  bookedGuestsCount: number,
  nightlyRateUSD = 85.00,
  stayDurationNights = 3
): SummerGuestAllocationMetrics {
  const allocated = Math.min(availableSuitesCount, bookedGuestsCount);
  const revenue = Math.round(allocated * nightlyRateUSD * stayDurationNights * 100) / 100;
  const risk = bookedGuestsCount > availableSuitesCount;

  return {
    totalGuestSuitesAllocated: allocated,
    revenueGeneratedUSD: revenue,
    isOverbookingRisk: risk,
  };
}
