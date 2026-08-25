// =============================================================================
// File: src/types/carbonOffset.ts
// Issue: #3936 - Develop a 'Dynamic Ride-Share Carbon Offset' Calculator
// Description: Type definitions for ride-share carbon emissions, EPA multipliers,
//              geospatial distance tracking, and eco-equivalency statistics.
// =============================================================================

export type VehicleFuelType = "gasoline_sedan" | "gasoline_suv" | "hybrid" | "electric_ev" | "diesel_van";

export interface GeoLocation {
  label: string;
  latitude: number;
  longitude: number;
  isCampusHub?: boolean;
}

export interface RideShareTrip {
  id: string;
  eventId?: string;
  eventTitle?: string;
  clubId?: string;
  clubName?: string;
  driverId: string;
  driverName: string;
  origin: GeoLocation;
  destination: GeoLocation;
  distanceMiles: number;
  distanceKm: number;
  riderCount: number; // excluding driver (i.e. cars taken off road = riderCount)
  vehicleType: VehicleFuelType;
  completedAt: string;
  co2SavedGrams: number;
  co2SavedPounds: number;
  co2SavedKg: number;
}

export interface EcoEquivalents {
  treeSeedlingsGrownFor10Years: number; // EPA formula: ~0.06 trees / kg CO2
  gallonsOfGasolineSaved: number; // ~8,887 grams CO2 per gallon
  smartphonesCharged: number; // ~8.22 grams CO2 per full charge
  poundsOfCoalAvoided: number; // ~0.94 lbs coal per lb CO2
  kwhElectricitySaved: number; // ~0.85 lbs CO2 per kWh US grid average
}

export interface GlobalImpactSummary {
  totalTripsCompleted: number;
  totalCarpoolMilesShared: number;
  totalCarsDisplaced: number;
  totalCo2SavedPounds: number;
  totalCo2SavedKg: number;
  totalCo2SavedMetricTons: number;
  equivalents: EcoEquivalents;
  activeClubCount: number;
}

export interface ClubEcoLeaderboardEntry {
  clubId: string;
  clubName: string;
  totalTrips: number;
  totalRidersShared: number;
  totalCo2SavedKg: number;
  sustainabilityTier: "Seedling" | "Sapling" | "Canopy" | "Old Growth Forest";
}
