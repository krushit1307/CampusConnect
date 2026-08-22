export const LOCATION_SEARCH_MIN_LENGTH = 3;

export function normalizeLocationQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 200);
}

export function isSearchableLocationQuery(value: string): boolean {
  const normalized = normalizeLocationQuery(value);
  return normalized.length >= LOCATION_SEARCH_MIN_LENGTH && normalized.toLowerCase() !== "online";
}

export function isValidLocationCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
