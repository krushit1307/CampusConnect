/**
 * Dormitory Laundry Room Washer & Dryer Usage Telemetry Utilities
 */

export interface LaundryMachineTelemetry {
  availableWashersCount: number;
  availableDryersCount: number;
  peakUsageHour: string;
}

/**
 * Calculates dormitory laundry machine availability.
 */
export function calculateLaundryMachineAvailability(
  totalWashers: number,
  occupiedWashers: number,
  totalDryers: number,
  occupiedDryers: number
): LaundryMachineTelemetry {
  return {
    availableWashersCount: Math.max(0, totalWashers - occupiedWashers),
    availableDryersCount: Math.max(0, totalDryers - occupiedDryers),
    peakUsageHour: '18:00 - 21:00 Evening Peak',
  };
}
