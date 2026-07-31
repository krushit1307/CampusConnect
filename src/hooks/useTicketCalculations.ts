// src/hooks/useTicketCalculations.ts
import { useMemo } from "react";
import { TicketTier } from "../lib/eventFormSchema";

export interface TicketCalculations {
  totalCapacity: number;
  maxPotentialRevenue: number;
  averageTicketPrice: number;
  activeTiersCount: number;
}

/**
 * Hook to perform real-time financial calculations based on the
 * dynamic array of ticket tiers. Used to display projections to the admin.
 */
export const useTicketCalculations = (tiers: TicketTier[]): TicketCalculations => {
  return useMemo(() => {
    const activeTiers = tiers.filter((t) => t.isActive);

    const totalCapacity = activeTiers.reduce((sum, tier) => sum + tier.capacity, 0);

    const maxPotentialRevenue = activeTiers.reduce((sum, tier) => {
      return sum + tier.price * tier.capacity;
    }, 0);

    const averageTicketPrice =
      totalCapacity > 0
        ? activeTiers.reduce((sum, tier) => sum + tier.price * (tier.capacity / totalCapacity), 0)
        : 0;

    return {
      totalCapacity,
      maxPotentialRevenue,
      averageTicketPrice,
      activeTiersCount: activeTiers.length,
    };
  }, [tiers]);
};
