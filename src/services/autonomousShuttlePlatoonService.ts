// =============================================================================
// File: src/services/autonomousShuttlePlatoonService.ts
// Task: Dynamic "Carpool" Autonomous Shuttle Capacity Optimizer
// Description: Convoy & Platooning dispatch algorithm for autonomous campus assets.
//              Dynamically couples autonomous shuttle units into aerodynamic platoons
//              during peak event let-outs to multiply passenger capacity and reduce battery usage.
// =============================================================================

export type ShuttleAssetStatus = "available" | "in_platoon" | "charging" | "maintenance";

export interface AutonomousShuttleAsset {
  id: string;
  name: string;
  capacity: number; // e.g. 12 seats
  batteryPct: number; // 0..100
  status: ShuttleAssetStatus;
  lat: number;
  lng: number;
  speedMps: number;
  isLeadEligible: boolean;
}

export type PlatoonStatus = "forming" | "en_route" | "disbanding" | "completed";

export interface PlatoonDispatchPlan {
  id: string;
  routeId: string;
  routeName: string;
  pickupStop: string;
  dropoffStop: string;
  leadVehicle: AutonomousShuttleAsset;
  followerVehicles: AutonomousShuttleAsset[];
  totalVehicles: number;
  totalCapacity: number;
  passengerDemandCount: number;
  headwayMeters: number; // inter-vehicle gap, e.g. 6 meters
  energySavingsPct: number; // e.g. 18.5% drafting savings
  status: PlatoonStatus;
  createdAt: string;
  estimatedArrivalMinutes: number;
}

export interface PlatoonEfficiencyMetrics {
  platoonSize: number;
  energySavingsPct: number;
  throughputMultiplier: number;
  co2ReductionKgPerHour: number;
}

/** Default campus fleet of autonomous shuttles */
export const INITIAL_AUTONOMOUS_FLEET: AutonomousShuttleAsset[] = [
  {
    id: "av-shuttle-101",
    name: "CyberShuttle Alpha (AV-101)",
    capacity: 14,
    batteryPct: 92,
    status: "available",
    lat: 37.7749,
    lng: -122.4194,
    speedMps: 11.2,
    isLeadEligible: true,
  },
  {
    id: "av-shuttle-102",
    name: "CyberShuttle Beta (AV-102)",
    capacity: 14,
    batteryPct: 88,
    status: "available",
    lat: 37.7751,
    lng: -122.4191,
    speedMps: 11.0,
    isLeadEligible: true,
  },
  {
    id: "av-shuttle-103",
    name: "CyberShuttle Gamma (AV-103)",
    capacity: 12,
    batteryPct: 85,
    status: "available",
    lat: 37.7753,
    lng: -122.4188,
    speedMps: 10.8,
    isLeadEligible: false,
  },
  {
    id: "av-shuttle-104",
    name: "CyberShuttle Delta (AV-104)",
    capacity: 12,
    batteryPct: 79,
    status: "available",
    lat: 37.7755,
    lng: -122.4185,
    speedMps: 10.5,
    isLeadEligible: false,
  },
  {
    id: "av-shuttle-105",
    name: "CyberShuttle Epsilon (AV-105)",
    capacity: 14,
    batteryPct: 18, // low battery - excluded from platooning
    status: "charging",
    lat: 37.7740,
    lng: -122.4200,
    speedMps: 0.0,
    isLeadEligible: false,
  },
];

/** Minimum battery percentage required to join an autonomous platoon convoy */
export const MIN_PLATOON_BATTERY_PCT = 20;

/** Max vehicles allowed in a single platooning convoy */
export const MAX_PLATOON_UNITS = 4;

/**
 * Calculates aerodynamic energy savings and capacity throughput multiplier for a platoon size.
 */
export function calculatePlatoonEfficiency(platoonSize: number): PlatoonEfficiencyMetrics {
  if (platoonSize <= 1) {
    return {
      platoonSize: 1,
      energySavingsPct: 0,
      throughputMultiplier: 1.0,
      co2ReductionKgPerHour: 0.0,
    };
  }

  // Aerodynamic drafting efficiency scales with convoy size up to 4 units:
  // 2 units -> ~15% savings, 3 units -> ~20% savings, 4 units -> ~24% savings
  const energySavingsPct = Math.min(25, 10 + platoonSize * 3.5);
  const throughputMultiplier = Math.round(platoonSize * 0.95 * 10) / 10;
  const co2ReductionKgPerHour = Math.round(platoonSize * 1.8 * (energySavingsPct / 100) * 10) / 10;

  return {
    platoonSize,
    energySavingsPct: Math.round(energySavingsPct * 10) / 10,
    throughputMultiplier,
    co2ReductionKgPerHour,
  };
}

/**
 * Evaluates passenger surge demand and determines optimal autonomous shuttle convoy dispatch.
 */
export function evaluateSurgePlatoonDemand(
  passengerDemand: number,
  fleet: AutonomousShuttleAsset[] = INITIAL_AUTONOMOUS_FLEET
): {
  requiredVehiclesCount: number;
  eligibleVehicles: AutonomousShuttleAsset[];
  canFormPlatoon: boolean;
  recommendedPlatoonSize: number;
} {
  // Filter available fleet with >20% battery
  const eligibleVehicles = fleet.filter(
    (v) => v.status === "available" && v.batteryPct >= MIN_PLATOON_BATTERY_PCT
  );

  // Average vehicle capacity is ~13 seats
  const requiredVehiclesCount = Math.min(
    MAX_PLATOON_UNITS,
    Math.max(1, Math.ceil(passengerDemand / 13))
  );

  const canFormPlatoon = requiredVehiclesCount >= 2 && eligibleVehicles.length >= 2;
  const recommendedPlatoonSize = Math.min(requiredVehiclesCount, eligibleVehicles.length);

  return {
    requiredVehiclesCount,
    eligibleVehicles,
    canFormPlatoon,
    recommendedPlatoonSize,
  };
}

/**
 * Forms an autonomous shuttle platoon convoy for surge demand optimization.
 */
export function createAutonomousPlatoon(
  passengerDemand: number,
  routeId: string = "route-express-north",
  routeName: string = "North Campus Express",
  pickupStop: string = "Student Union Hub",
  dropoffStop: string = "Innovation Hall & Dorms",
  fleet: AutonomousShuttleAsset[] = INITIAL_AUTONOMOUS_FLEET
): PlatoonDispatchPlan {
  const { eligibleVehicles, recommendedPlatoonSize } = evaluateSurgePlatoonDemand(
    passengerDemand,
    fleet
  );

  if (eligibleVehicles.length === 0) {
    throw new Error("No eligible autonomous shuttle assets with sufficient battery available.");
  }

  // Sort eligible vehicles by lead eligibility and battery level descending
  const sortedFleet = [...eligibleVehicles].sort((a, b) => {
    if (a.isLeadEligible !== b.isLeadEligible) {
      return a.isLeadEligible ? -1 : 1;
    }
    return b.batteryPct - a.batteryPct;
  });

  const selectedVehicles = sortedFleet.slice(0, Math.max(1, recommendedPlatoonSize));
  const leadVehicle = selectedVehicles[0];
  const followerVehicles = selectedVehicles.slice(1);

  const totalCapacity = selectedVehicles.reduce((sum, v) => sum + v.capacity, 0);
  const efficiency = calculatePlatoonEfficiency(selectedVehicles.length);

  // Mark selected vehicles in_platoon status
  selectedVehicles.forEach((v) => {
    v.status = "in_platoon";
  });

  return {
    id: `platoon-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    routeId,
    routeName,
    pickupStop,
    dropoffStop,
    leadVehicle,
    followerVehicles,
    totalVehicles: selectedVehicles.length,
    totalCapacity,
    passengerDemandCount: passengerDemand,
    headwayMeters: selectedVehicles.length > 1 ? 6 : 0, // 6m electronic drafting headway
    energySavingsPct: efficiency.energySavingsPct,
    status: "en_route",
    createdAt: new Date().toISOString(),
    estimatedArrivalMinutes: 4,
  };
}

/**
 * Disbands an autonomous platoon convoy, returning assets to available fleet status.
 */
export function disbandPlatoon(
  platoon: PlatoonDispatchPlan,
  fleet: AutonomousShuttleAsset[] = INITIAL_AUTONOMOUS_FLEET
): AutonomousShuttleAsset[] {
  const allVehicleIds = new Set([
    platoon.leadVehicle.id,
    ...platoon.followerVehicles.map((v) => v.id),
  ]);

  return fleet.map((v) => {
    if (allVehicleIds.has(v.id)) {
      return {
        ...v,
        status: "available",
      };
    }
    return v;
  });
}
