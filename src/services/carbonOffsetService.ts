// =============================================================================
// File: src/services/carbonOffsetService.ts
// Issue: #3936 - Develop a 'Dynamic Ride-Share Carbon Offset' Calculator
// Description: Geospatial calculations, EPA carbon emissions factors,
//              ecological equivalency models, and impact export utilities.
// =============================================================================

import { supabase } from "@/lib/supabase";
import type {
  VehicleFuelType,
  GeoLocation,
  RideShareTrip,
  EcoEquivalents,
  GlobalImpactSummary,
  ClubEcoLeaderboardEntry,
} from "@/types/carbonOffset";

/**
 * EPA Greenhouse Gas Standard Emissions Factors (Grams of CO2 per mile driven).
 * Reference: EPA Office of Transportation and Air Quality (OTAQ) Standards.
 */
export const EPA_EMISSIONS_FACTORS_GRAMS_PER_MILE: Record<VehicleFuelType, number> = {
  gasoline_sedan: 404.0, // Standard 4-door passenger sedan
  gasoline_suv: 460.0, // Mid-size/large SUV or pickup
  hybrid: 210.0, // Hybrid-electric powertrain
  electric_ev: 110.0, // US Grid lifecycle average
  diesel_van: 430.0, // Multi-passenger van
};

/**
 * Common campus destinations & hubs for easy distance calculation presets.
 */
export const CAMPUS_GEO_PRESETS: GeoLocation[] = [
  { label: "Main Student Union (Campus Hub)", latitude: 37.7749, longitude: -122.4194, isCampusHub: true },
  { label: "North Campus Engineering Quad", latitude: 37.7833, longitude: -122.4167, isCampusHub: true },
  { label: "Off-Campus Housing & Greek Row", latitude: 37.765, longitude: -122.432, isCampusHub: false },
  { label: "Downtown Tech Park / Hackathon Center", latitude: 37.7915, longitude: -122.399, isCampusHub: false },
  { label: "Regional Airport / Transit Center", latitude: 37.6213, longitude: -122.379, isCampusHub: false },
  { label: "State Park / Outdoor Retreat Lodge", latitude: 37.8816, longitude: -122.578, isCampusHub: false },
];

/**
 * Calculates geodesic distance between two coordinates using the Haversine formula.
 */
export function calculateHaversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;

  return Number(dist.toFixed(2));
}

/**
 * Calculates net CO2 emissions saved by carpooling rather than taking separate cars.
 * Grams CO2 Saved = Distance (miles) * Vehicle Factor * Riders (cars taken off the road).
 */
export function calculateTripCarbonOffset(
  distanceMiles: number,
  riderCount: number, // number of passengers taking the ride (excluding driver)
  vehicleType: VehicleFuelType = "gasoline_sedan"
): {
  co2SavedGrams: number;
  co2SavedPounds: number;
  co2SavedKg: number;
} {
  const factor = EPA_EMISSIONS_FACTORS_GRAMS_PER_MILE[vehicleType] || 404.0;
  const carsDisplaced = Math.max(1, riderCount);
  const co2SavedGrams = distanceMiles * factor * carsDisplaced;
  const co2SavedPounds = co2SavedGrams * 0.00220462;
  const co2SavedKg = co2SavedGrams / 1000.0;

  return {
    co2SavedGrams: Number(co2SavedGrams.toFixed(1)),
    co2SavedPounds: Number(co2SavedPounds.toFixed(1)),
    co2SavedKg: Number(co2SavedKg.toFixed(2)),
  };
}

/**
 * Converts saved CO2 kilograms into intuitive, real-world ecological equivalents.
 */
export function calculateEcoEquivalents(co2SavedKg: number): EcoEquivalents {
  const co2SavedLbs = co2SavedKg * 2.20462;

  return {
    treeSeedlingsGrownFor10Years: Number((co2SavedKg * 0.0165).toFixed(1)), // ~60 kg CO2 absorbed per tree in 10 years
    gallonsOfGasolineSaved: Number((co2SavedKg / 8.887).toFixed(1)), // ~8.887 kg CO2 / gallon gas
    smartphonesCharged: Math.round(co2SavedKg / 0.00822), // ~8.22 grams CO2 per charge
    poundsOfCoalAvoided: Number((co2SavedLbs * 0.94).toFixed(1)), // ~0.94 lbs coal per lb CO2
    kwhElectricitySaved: Number((co2SavedLbs * 1.18).toFixed(1)), // ~0.85 lbs CO2 / kWh
  };
}

/**
 * Generate standard mock dataset of carpool trips for realistic visualization.
 */
export function getMockRideShareTrips(): RideShareTrip[] {
  return [
    {
      id: "trip-001",
      eventId: "evt-hackathon-2026",
      eventTitle: "Annual Spring Hackathon",
      clubId: "club-acm-1",
      clubName: "ACM Student Chapter",
      driverId: "usr-01",
      driverName: "Alex Rivera",
      origin: CAMPUS_GEO_PRESETS[0],
      destination: CAMPUS_GEO_PRESETS[3],
      distanceMiles: 14.5,
      distanceKm: 23.3,
      riderCount: 3,
      vehicleType: "hybrid",
      completedAt: "2026-03-22T18:30:00Z",
      co2SavedGrams: 9135,
      co2SavedPounds: 20.1,
      co2SavedKg: 9.14,
    },
    {
      id: "trip-002",
      eventId: "evt-gala-2026",
      eventTitle: "Engineering Formal Gala",
      clubId: "club-swe-1",
      clubName: "Society of Women Engineers",
      driverId: "usr-02",
      driverName: "Maya Chen",
      origin: CAMPUS_GEO_PRESETS[1],
      destination: CAMPUS_GEO_PRESETS[5],
      distanceMiles: 28.2,
      distanceKm: 45.4,
      riderCount: 4,
      vehicleType: "gasoline_sedan",
      completedAt: "2026-03-20T19:00:00Z",
      co2SavedGrams: 45571,
      co2SavedPounds: 100.5,
      co2SavedKg: 45.57,
    },
    {
      id: "trip-003",
      eventId: "evt-summit-2026",
      eventTitle: "Robotics Design Expo",
      clubId: "club-robotics-1",
      clubName: "Robotics Guild",
      driverId: "usr-03",
      driverName: "Liam Vance",
      origin: CAMPUS_GEO_PRESETS[2],
      destination: CAMPUS_GEO_PRESETS[0],
      distanceMiles: 6.8,
      distanceKm: 10.9,
      riderCount: 2,
      vehicleType: "electric_ev",
      completedAt: "2026-03-18T14:15:00Z",
      co2SavedGrams: 1496,
      co2SavedPounds: 3.3,
      co2SavedKg: 1.5,
    },
    {
      id: "trip-004",
      eventId: "evt-retreat-2026",
      eventTitle: "Outdoor Leadership Campout",
      clubId: "club-outdoors-1",
      clubName: "Outdoor Adventure Society",
      driverId: "usr-04",
      driverName: "Sarah Jenkins",
      origin: CAMPUS_GEO_PRESETS[0],
      destination: CAMPUS_GEO_PRESETS[5],
      distanceMiles: 34.0,
      distanceKm: 54.7,
      riderCount: 5,
      vehicleType: "diesel_van",
      completedAt: "2026-03-15T09:00:00Z",
      co2SavedGrams: 73100,
      co2SavedPounds: 161.2,
      co2SavedKg: 73.1,
    },
  ];
}

/**
 * Calculates overall campus global impact summary from an array of trips.
 */
export function calculateGlobalImpactSummary(trips: RideShareTrip[]): GlobalImpactSummary {
  let totalMiles = 0;
  let totalCars = 0;
  let totalGrams = 0;
  const clubSet = new Set<string>();

  trips.forEach((t) => {
    totalMiles += t.distanceMiles;
    totalCars += t.riderCount;
    totalGrams += t.co2SavedGrams;
    if (t.clubId) clubSet.add(t.clubId);
  });

  const totalKg = totalGrams / 1000.0;
  const totalLbs = totalGrams * 0.00220462;
  const totalMetricTons = totalKg / 1000.0;

  return {
    totalTripsCompleted: trips.length,
    totalCarpoolMilesShared: Number(totalMiles.toFixed(1)),
    totalCarsDisplaced: totalCars,
    totalCo2SavedPounds: Number(totalLbs.toFixed(1)),
    totalCo2SavedKg: Number(totalKg.toFixed(2)),
    totalCo2SavedMetricTons: Number(totalMetricTons.toFixed(3)),
    equivalents: calculateEcoEquivalents(totalKg),
    activeClubCount: Math.max(1, clubSet.size),
  };
}

/**
 * Aggregates club sustainability leaderboard.
 */
export function getClubEcoLeaderboard(trips: RideShareTrip[]): ClubEcoLeaderboardEntry[] {
  const map = new Map<string, { name: string; trips: number; riders: number; co2Kg: number }>();

  trips.forEach((t) => {
    const clubKey = t.clubId || "general";
    const name = t.clubName || "Independent Student Carpools";
    const current = map.get(clubKey) || { name, trips: 0, riders: 0, co2Kg: 0 };
    current.trips += 1;
    current.riders += t.riderCount;
    current.co2Kg += t.co2SavedKg;
    map.set(clubKey, current);
  });

  const list: ClubEcoLeaderboardEntry[] = [];
  map.forEach((val, id) => {
    let tier: ClubEcoLeaderboardEntry["sustainabilityTier"] = "Seedling";
    if (val.co2Kg > 100) tier = "Old Growth Forest";
    else if (val.co2Kg > 50) tier = "Canopy";
    else if (val.co2Kg > 20) tier = "Sapling";

    list.push({
      clubId: id,
      clubName: val.name,
      totalTrips: val.trips,
      totalRidersShared: val.riders,
      totalCo2SavedKg: Number(val.co2Kg.toFixed(2)),
      sustainabilityTier: tier,
    });
  });

  return list.sort((a, b) => b.totalCo2SavedKg - a.totalCo2SavedKg);
}

/**
 * Export official ESG Sustainability Audit CSV report.
 */
export function exportSustainabilityAuditCSV(
  summary: GlobalImpactSummary,
  trips: RideShareTrip[],
  fileName: string = "campus_rideshare_carbon_offset_audit.csv"
): void {
  const lines = [
    `CampusConnect Official ESG Sustainability & Carbon Offset Audit`,
    `Total Carpool Trips,${summary.totalTripsCompleted}`,
    `Total Passenger Miles Shared,${summary.totalCarpoolMilesShared} miles`,
    `Total Individual Cars Displaced,${summary.totalCarsDisplaced} vehicles`,
    `Total Net CO2 Prevented,${summary.totalCo2SavedKg} kg (${summary.totalCo2SavedPounds} lbs)`,
    `Equivalent Tree Seedlings Grown (10 Years),${summary.equivalents.treeSeedlingsGrownFor10Years} trees`,
    `Equivalent Gallons of Gas Displaced,${summary.equivalents.gallonsOfGasolineSaved} gallons`,
    `Equivalent Smartphone Charges Avoided,${summary.equivalents.smartphonesCharged} charges`,
    `\n-- ITEMISED CARPOOL LOG --`,
    `Trip ID,Event Name,Club,Driver,Distance (mi),Riders,Vehicle Type,CO2 Saved (kg),Timestamp`,
    ...trips.map(
      (t) =>
        `"${t.id}","${t.eventTitle || ""}","${t.clubName || ""}","${t.driverName}",${t.distanceMiles},${t.riderCount},"${t.vehicleType}",${t.co2SavedKg},"${t.completedAt}"`
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Save new completed ride-share offset to Supabase database.
 */
export async function recordRideShareOffset(
  trip: Omit<RideShareTrip, "id" | "completedAt">
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      event_id: trip.eventId,
      club_id: trip.clubId,
      driver_id: trip.driverId,
      origin_lat: trip.origin.latitude,
      origin_lon: trip.origin.longitude,
      origin_label: trip.origin.label,
      dest_lat: trip.destination.latitude,
      dest_lon: trip.destination.longitude,
      dest_label: trip.destination.label,
      distance_miles: trip.distanceMiles,
      rider_count: trip.riderCount,
      vehicle_type: trip.vehicleType,
      co2_saved_grams: trip.co2SavedGrams,
      co2_saved_kg: trip.co2SavedKg,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("rideshare_carbon_offsets").insert(payload);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to persist carbon offset record" };
  }
}
