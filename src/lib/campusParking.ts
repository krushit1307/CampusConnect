export interface DesignatedParkingLot {
  id: string;
  name: string;
  capacity: number;
  currentOccupancy: number;
  isFree: boolean;
  hourlyRate?: number;
  lat: number;
  lng: number;
  polygonCoordinates?: Array<[number, number]>;
  entranceLat?: number;
  entranceLng?: number;
  walkingMinutesToVenue?: number;
}

export interface OccupancyStatus {
  occupancyPercent: number;
  status: "Available" | "Filling Up" | "Full";
  level: "green" | "yellow" | "red";
  colorHex: string;
  bgClass: string;
  textClass: string;
}

/**
 * Computes real-time parking lot occupancy percentage and color status (#3537).
 * Green = <70% (Available), Yellow = 70-89% (Filling Up), Red = >=90% (Full).
 */
export function getParkingOccupancyStatus(
  currentOccupancy: number,
  capacity: number
): OccupancyStatus {
  const cap = Math.max(1, capacity || 100);
  const occ = Math.max(0, currentOccupancy || 0);
  const occupancyPercent = Math.min(100, Math.round((occ / cap) * 100));

  if (occupancyPercent >= 90) {
    return {
      occupancyPercent,
      status: "Full",
      level: "red",
      colorHex: "#ef4444",
      bgClass: "bg-rose-500",
      textClass: "text-rose-700",
    };
  }

  if (occupancyPercent >= 70) {
    return {
      occupancyPercent,
      status: "Filling Up",
      level: "yellow",
      colorHex: "#f59e0b",
      bgClass: "bg-amber-500",
      textClass: "text-amber-700",
    };
  }

  return {
    occupancyPercent,
    status: "Available",
    level: "green",
    colorHex: "#10b981",
    bgClass: "bg-emerald-500",
    textClass: "text-emerald-700",
  };
}

/**
 * Generates 1-click Google Maps navigation URL to parking lot entrance GPS coordinates (#3537).
 */
export function getGoogleMapsParkingNavUrl(lat: number, lng: number, label?: string): string {
  const query = label ? encodeURIComponent(label) : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${query ? `&destination_place_id=${query}` : ""}`;
}

/**
 * Generates 1-click Apple Maps navigation URL to parking lot entrance GPS coordinates (#3537).
 */
export function getAppleMapsParkingNavUrl(lat: number, lng: number, label?: string): string {
  const nameParam = label ? `&q=${encodeURIComponent(label)}` : "";
  return `https://maps.apple.com/?daddr=${lat},${lng}${nameParam}`;
}
