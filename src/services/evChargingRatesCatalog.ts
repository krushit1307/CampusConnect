/**
 * Campus EV Charging Station Billing & Kilowatt-Hour Rate Utilities
 */

export const EV_CHARGING_RATES_CATALOG = [
  { stationId: 'EV-STATION-NORTH-1', ratePerKwhUSD: 0.18, maxPowerKw: 50.0 },
  { stationId: 'EV-STATION-SOUTH-2', ratePerKwhUSD: 0.22, maxPowerKw: 150.0 },
  { stationId: 'EV-STATION-GARAGE-3', ratePerKwhUSD: 0.15, maxPowerKw: 22.0 },
];

/**
 * Calculates EV charging session total cost in USD.
 */
export function calculateEvChargingSessionCost(kwhConsumed: number, stationId: string): number {
  const match = EV_CHARGING_RATES_CATALOG.find(s => s.stationId === stationId);
  const rate = match ? match.ratePerKwhUSD : 0.20;
  return Math.round(kwhConsumed * rate * 100) / 100;
}
