export interface Coordinate {
  latitude: number;
  longitude: number;
}

export type MobilityProvider = "bird" | "lime" | "spin";

export interface EScooter {
  id: string;
  provider: MobilityProvider;
  latitude: number;
  longitude: number;
  batteryPercent: number; // 0 to 100
  distanceToStopFeet: number;
  distanceToStopMeters: number;
  unlockPrice: number; // e.g. 1.00 ($)
  pricePerMinute: number; // e.g. 0.15 ($)
  deepLink: string;
  isReserved?: boolean;
}

export interface TransitStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  arrivalDelayMinutes?: number;
}

export interface TransitItineraryLeg {
  id: string;
  mode: "walk" | "bus" | "train" | "subway";
  routeName?: string; // e.g. "Line 104 Campus Express"
  departureTime: string; // ISO or Clock time
  arrivalTime: string;
  originName: string;
  destinationName: string;
  originCoords: Coordinate;
  destinationCoords: Coordinate;
  distanceMiles: number;
  estimatedMinutes: number;
}

export interface TransitItinerary {
  id: string;
  name: string; // e.g. "Bus Route 104 + Walking"
  legs: TransitItineraryLeg[];
  totalMinutes: number;
  walkingDistanceMiles: number;
  finalStop: TransitStop;
}

export interface MobilityProviderConfig {
  provider: MobilityProvider;
  apiKey?: string;
  apiEndpoint?: string;
  enabled: boolean;
  minBatteryRequired?: number; // default e.g. 20%
}

export interface ScooterSyncRequest {
  latitude: number;
  longitude: number;
  radiusFeet?: number; // default 200 feet
  minBattery?: number;
}

export interface ScooterSyncResponse {
  success: boolean;
  provider: string;
  scooters: EScooter[];
  error?: string;
}

export interface TransitSyncWidgetState {
  itineraries: TransitItinerary[];
  selectedItineraryId: string | null;
  scooters: EScooter[];
  loadingScooters: boolean;
  scooterError: string | null;
  lastUpdated: string | null;
  reservedScooterId: string | null;
}
