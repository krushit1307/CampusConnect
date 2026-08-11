export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface RoutePlannerInput {
  origin: GeoCoordinates;
  destination: GeoCoordinates;
  walkingSpeedMetersPerSec?: number; // Defaults to average human walking speed ~1.4 m/s (5 km/h)
}

export interface CampusRouteResult {
  distanceMeters: number;
  estimatedWalkingMinutes: number;
  waypoints: [number, number][]; // Array of [lat, lng] tuples for Leaflet polylines
  formattedDistance: string;
}

const DEFAULT_WALKING_SPEED = 1.4; // 1.4 m/s (~5 km/h)

/**
 * Calculates straight-line geodesic distance between two points using the Haversine formula.
 */
export function calculateHaversineDistance(coord1: GeoCoordinates, coord2: GeoCoordinates): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLng = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) / 180) *
      Math.cos((coord2.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Generates a walking route, distance, and ETA between campus locations.
 */
export function calculateCampusRoute(input: RoutePlannerInput): CampusRouteResult {
  const distanceMeters = calculateHaversineDistance(input.origin, input.destination);
  const speed = input.walkingSpeedMetersPerSec || DEFAULT_WALKING_SPEED;

  const estimatedWalkingSeconds = distanceMeters / speed;
  const estimatedWalkingMinutes = Math.max(1, Math.round(estimatedWalkingSeconds / 60));

  // Formats waypoints into Leaflet [lat, lng] polyline coordinate tuples
  const waypoints: [number, number][] = [
    [input.origin.latitude, input.origin.longitude],
    [
      (input.origin.latitude + input.destination.latitude) / 2,
      (input.origin.longitude + input.destination.longitude) / 2,
    ],
    [input.destination.latitude, input.destination.longitude],
  ];

  const formattedDistance =
    distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${distanceMeters} m`;

  return {
    distanceMeters,
    estimatedWalkingMinutes,
    waypoints,
    formattedDistance,
  };
}
