export interface EscortLocation {
  lat: number;
  lng: number;
}

export interface SafetyEscortTrackerState {
  requestId: string;
  studentId: string;
  officerName: string;
  officerBadgeNumber: string;
  studentLocation: EscortLocation;
  officerLocation: EscortLocation;
  etaMinutes: number;
  distanceMiles: number;
  status: "dispatched" | "en_route" | "arrived" | "completed";
  lastUpdated: string;
}

/**
 * Calculates distance in miles and ETA in minutes between officer and student (#4686).
 */
export function calculateEscortEta(
  officerLat: number,
  officerLng: number,
  studentLat: number,
  studentLng: number
): { distanceMiles: number; etaMinutes: number } {
  const dLat = (studentLat - officerLat) * 69.0;
  const dLng = (studentLng - officerLng) * 54.6;
  const distanceMiles = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 100) / 100;
  const etaMinutes = Math.max(1, Math.round((distanceMiles / 0.15) * 10) / 10);

  return {
    distanceMiles,
    etaMinutes: distanceMiles <= 0.02 ? 0 : Math.round(etaMinutes),
  };
}

/**
 * Updates officer GPS coordinates, re-calculates ETA, and updates arrival status (#4686).
 */
export function updateOfficerGpsCoordinates(
  state: SafetyEscortTrackerState,
  newLat: number,
  newLng: number
): SafetyEscortTrackerState {
  const { distanceMiles, etaMinutes } = calculateEscortEta(
    newLat,
    newLng,
    state.studentLocation.lat,
    state.studentLocation.lng
  );

  const isArrived = distanceMiles <= 0.02;

  return {
    ...state,
    officerLocation: { lat: newLat, lng: newLng },
    distanceMiles,
    etaMinutes,
    status: isArrived ? "arrived" : "en_route",
    lastUpdated: new Date().toISOString(),
  };
}
