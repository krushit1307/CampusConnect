import { RidePassenger } from '@/types/carpool';

/**
 * Calculates fair, proportional multi-stop gas and toll cost splits for campus rides.
 * Uses a base mileage rate ($0.35/mi) divided proportionally across overlapping passenger legs.
 */
export function calculateProportionalFareSplit(
  totalTripMiles: number,
  baseFuelCostPerMile: number = 0.35,
  passengers: { id: string; distanceMiles: number }[]
): Record<string, number> {
  const result: Record<string, number> = {};
  if (passengers.length === 0) return result;

  const totalPassengerMiles = passengers.reduce((sum, p) => sum + p.distanceMiles, 0);
  const totalFuelCost = totalTripMiles * baseFuelCostPerMile;

  passengers.forEach((p) => {
    // Proportional share based on fraction of total passenger miles
    const ratio = totalPassengerMiles > 0 ? p.distanceMiles / totalPassengerMiles : 1 / passengers.length;
    const share = Math.max(1.5, Math.round(totalFuelCost * ratio * 100) / 100);
    result[p.id] = share;
  });

  return result;
}
