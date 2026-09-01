/**
 * Emergency Campus Safety Drone Dispatch — pure logic (#4842)
 * Decides whether a missing/overdue student's last known GPS fix is
 * usable, and shapes the dispatch payload sent to the Drone Dispatch API.
 */

export const MAX_LOCATION_FIX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export interface LastKnownLocation {
  latitude: number | null;
  longitude: number | null;
  updatedAtIso: string | null;
}

/** A drone can only be usefully routed to a coordinate that is recent enough to still be relevant. */
export function isLocationFixUsable(
  location: LastKnownLocation,
  now: Date = new Date(),
  maxAgeMs: number = MAX_LOCATION_FIX_AGE_MS,
): { usable: boolean; reason?: string } {
  if (location.latitude == null || location.longitude == null || !location.updatedAtIso) {
    return { usable: false, reason: "No GPS fix has been recorded for this student yet." };
  }

  const ageMs = now.getTime() - new Date(location.updatedAtIso).getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) {
    return { usable: false, reason: "The recorded GPS fix has an invalid timestamp." };
  }
  if (ageMs > maxAgeMs) {
    return { usable: false, reason: "The last known GPS fix is too stale to route a drone to." };
  }

  return { usable: true };
}

export interface DroneDispatchPayload {
  target_latitude: number;
  target_longitude: number;
  priority: "EMERGENCY";
  requested_by: string;
  reason: string;
}

/** Builds the high-priority webhook payload sent to the University's Drone Dispatch API. */
export function buildDispatchPayload(
  location: { latitude: number; longitude: number },
  dispatchedByUserId: string,
  studentUserId: string,
): DroneDispatchPayload {
  return {
    target_latitude: location.latitude,
    target_longitude: location.longitude,
    priority: "EMERGENCY",
    requested_by: dispatchedByUserId,
    reason: `Student ${studentUserId} did not confirm safe during an active Safety Roll Call.`,
  };
}