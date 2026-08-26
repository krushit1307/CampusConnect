export const DEFAULT_GEOFENCE_RADIUS_METERS = 500;
export const GEOFENCE_ACKNOWLEDGEMENT_WINDOW_MS = 3 * 60 * 1000;

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export function haversineDistanceMeters(from: GeoPoint, to: GeoPoint): number {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const fromLatitude = (from.latitude * Math.PI) / 180;
  const toLatitude = (to.latitude * Math.PI) / 180;

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function isOutsideGeofence(distanceMeters: number, radiusMeters: number): boolean {
  return (
    Number.isFinite(distanceMeters) &&
    Number.isFinite(radiusMeters) &&
    distanceMeters > radiusMeters
  );
}

export function getGeofenceAlertMessage(attendeeName?: string): string {
  return attendeeName
    ? `${attendeeName} has breached the event safety geofence.`
    : "You are leaving the event area. Are you okay?";
}

export function getGeofenceWindowRemainingMs(breachedAt: number, now = Date.now()): number {
  return Math.max(0, breachedAt + GEOFENCE_ACKNOWLEDGEMENT_WINDOW_MS - now);
}
