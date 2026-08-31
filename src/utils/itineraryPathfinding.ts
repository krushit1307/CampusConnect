import { GeoPoint } from "../services/carpoolRouteOptimizerService";

// Mock coordinates for known campus buildings to resolve names to GPS
const CAMPUS_BUILDINGS: Record<string, GeoPoint> = {
  "Student Center Complex": { lat: 37.7749, lng: -122.4194 },
  "Engineering Center": { lat: 37.7769, lng: -122.4174 },
  "Media Arts Building": { lat: 37.7789, lng: -122.4154 },
  "Main Library": { lat: 37.7759, lng: -122.4184 },
  "North Hall": { lat: 37.7739, lng: -122.4204 },
  "South Building": { lat: 37.7729, lng: -122.4214 },
};

function formatCoord(point: GeoPoint): string {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const aVal =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}

/**
 * Calculates walking travel time in seconds between two campus buildings.
 * Uses Google Maps Distance Matrix API if key is provided, falling back to straight-line heuristics.
 */
export async function getWalkingTravelTimeSeconds(
  originBuilding: string,
  destinationBuilding: string,
  apiKey?: string | null,
): Promise<number | null> {
  if (!originBuilding || !destinationBuilding) {
    return null;
  }

  const origin = CAMPUS_BUILDINGS[originBuilding];
  const destination = CAMPUS_BUILDINGS[destinationBuilding];

  if (!origin || !destination) {
    return null; // Graceful handling if coordinates are unavailable
  }

  if (origin.lat === destination.lat && origin.lng === destination.lng) {
    return 0; // Same building
  }

  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${formatCoord(
        origin,
      )}&destinations=${formatCoord(destination)}&mode=walking&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "OK" && data.rows[0].elements[0].status === "OK") {
        return data.rows[0].elements[0].duration.value;
      }
    } catch (e) {
      // Fallback to heuristic on network/API failure
      console.warn("Google Maps API failed, falling back to heuristic", e);
    }
  }

  // Fallback: Haversine distance with average walking speed (~1.4 m/s)
  const distance = haversineDistanceMeters(origin, destination);
  return Math.round(distance / 1.4);
}
