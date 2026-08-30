/**
 * Campus Parking Structure Occupancy & Electric Vehicle Charging Spot Utilities
 */

export interface ParkingStructureMetrics {
  totalParkingSpaces: number;
  availablePermitSpaces: number;
  availableEvChargingSpots: number;
  occupancyPercent: number;
  isGarageFull: boolean;
}

/**
 * Calculates garage parking space availability and EV charger occupancy.
 */
export function calculateParkingStructureOccupancy(
  totalSpaces: number,
  occupiedSpaces: number,
  totalEvSpots: number,
  occupiedEvSpots: number
): ParkingStructureMetrics {
  const availPermit = Math.max(0, totalSpaces - occupiedSpaces);
  const availEv = Math.max(0, totalEvSpots - occupiedEvSpots);
  const rate = totalSpaces > 0 ? Math.round((occupiedSpaces / totalSpaces) * 100.0 * 10) / 10 : 0;

  return {
    totalParkingSpaces: totalSpaces,
    availablePermitSpaces: availPermit,
    availableEvChargingSpots: availEv,
    occupancyPercent: rate,
    isGarageFull: availPermit === 0,
  };
}
