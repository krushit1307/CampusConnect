/**
 * Dynamic "Early Bird" Variable Thresholds Core Engine (#4530)
 * Allows inventory tiers (such as Early Bird) to scale dynamically with Venue Capacity changes
 * rather than remaining fixed at a static hardcoded integer.
 */

export interface DynamicTierConfig {
  id?: string;
  name: string;
  price: number;
  capacity?: number | null;
  capacity_percentage?: number | null;
  is_dynamic_capacity?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  sold_count?: number;
}

export interface EarlyBirdThresholdStatus {
  totalCapacity: number | null;
  soldCount: number;
  remainingTickets: number | null;
  isPercentageBased: boolean;
  percentageAllocated: number | null;
  fomoBadgeMessage: string;
  isFomoUrgent: boolean;
  isSoldOut: boolean;
}

/**
 * Calculates absolute capacity from a venue capacity and a percentage allocation.
 * E.g., 500 room capacity * 20% = 100 tickets.
 * E.g., 1000 room capacity * 20% = 200 tickets.
 */
export function calculateDynamicTierCapacity(
  venueCapacity: number,
  capacityPercentage: number,
): number {
  if (venueCapacity <= 0 || capacityPercentage <= 0) {
    return 0;
  }
  const calculated = Math.round(venueCapacity * (capacityPercentage / 100));
  return Math.max(1, calculated);
}

/**
 * Recalculates tier capacities across all configured tiers for an event given its current venue capacity.
 */
export function recalculateEventTierCapacities<T extends DynamicTierConfig>(
  venueCapacity: number | null | undefined,
  tiers: T[],
): T[] {
  if (!venueCapacity || venueCapacity <= 0) {
    return tiers;
  }

  return tiers.map((tier) => {
    if (
      tier.capacity_percentage !== undefined &&
      tier.capacity_percentage !== null &&
      tier.capacity_percentage > 0
    ) {
      const dynamicCapacity = calculateDynamicTierCapacity(venueCapacity, tier.capacity_percentage);
      return {
        ...tier,
        capacity: dynamicCapacity,
        is_dynamic_capacity: true,
      };
    }
    return tier;
  });
}

/**
 * Evaluates the Early Bird threshold status and FOMO messaging for an active tier.
 */
export function evaluateEarlyBirdThreshold(
  tier: DynamicTierConfig,
  venueCapacity?: number | null,
): EarlyBirdThresholdStatus {
  const soldCount = tier.sold_count || 0;
  const isPercentageBased = Boolean(tier.capacity_percentage && tier.capacity_percentage > 0);

  let effectiveCapacity = tier.capacity ?? null;
  if (isPercentageBased && venueCapacity && venueCapacity > 0) {
    effectiveCapacity = calculateDynamicTierCapacity(venueCapacity, tier.capacity_percentage!);
  }

  const remaining = effectiveCapacity !== null ? Math.max(0, effectiveCapacity - soldCount) : null;
  const isSoldOut = remaining !== null && remaining === 0;

  // Urgent FOMO condition: 10 or fewer tickets left, or <= 10% remaining
  const isFomoUrgent =
    remaining !== null &&
    remaining > 0 &&
    (remaining <= 10 || (effectiveCapacity !== null && remaining / effectiveCapacity <= 0.1));

  let fomoBadgeMessage = "";
  if (isSoldOut) {
    fomoBadgeMessage = `${tier.name} Sold Out!`;
  } else if (remaining !== null) {
    if (isPercentageBased) {
      fomoBadgeMessage = `Only ${remaining} ${tier.name} tickets left! (${tier.capacity_percentage}% venue allocation)`;
    } else {
      fomoBadgeMessage = `Only ${remaining} ${tier.name} tickets left!`;
    }
  } else {
    fomoBadgeMessage = `${tier.name} Available`;
  }

  return {
    totalCapacity: effectiveCapacity,
    soldCount,
    remainingTickets: remaining,
    isPercentageBased,
    percentageAllocated: tier.capacity_percentage ?? null,
    fomoBadgeMessage,
    isFomoUrgent,
    isSoldOut,
  };
}

/**
 * Validates tier capacity configuration ensuring valid percentage ranges (0 < pct <= 100) or positive capacity.
 */
export function validateTierCapacityConfig(tier: {
  capacity?: number | null;
  capacity_percentage?: number | null;
}): { isValid: boolean; error?: string } {
  if (tier.capacity_percentage !== null && tier.capacity_percentage !== undefined) {
    if (tier.capacity_percentage <= 0 || tier.capacity_percentage > 100) {
      return {
        isValid: false,
        error: "Capacity percentage must be between 0.01% and 100%.",
      };
    }
  }

  if (tier.capacity !== null && tier.capacity !== undefined) {
    if (tier.capacity <= 0) {
      return {
        isValid: false,
        error: "Fixed capacity must be greater than 0 if specified.",
      };
    }
  }

  return { isValid: true };
}
