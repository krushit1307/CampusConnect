export interface ExistingEventGeo {
  id: string;
  title: string;
  clubName: string;
  latitude: number;
  longitude: number;
  startTimeIso: string;
  endTimeIso: string;
}

export interface ProposedEventVenue {
  latitude: number;
  longitude: number;
  startTimeIso: string;
  endTimeIso: string;
  excludeEventId?: string;
}

export interface VenueCollisionWarning {
  hasConflict: boolean;
  conflictingEventId?: string;
  conflictingEventTitle?: string;
  conflictingClubName?: string;
  distanceMeters?: number;
  warningMessage?: string;
}

export const COLLISION_DISTANCE_THRESHOLD_METERS = 50;
export const TIME_WINDOW_BUFFER_HOURS = 2;

/**
 * Calculates Haversine distance in meters between two GPS coordinate points.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Evaluates whether two event timeframes overlap considering a 2-hour buffer window.
 */
export function isTimeWindowOverlapping(
  start1Iso: string,
  end1Iso: string,
  start2Iso: string,
  end2Iso: string,
  bufferHours = TIME_WINDOW_BUFFER_HOURS,
): boolean {
  const bufferMs = bufferHours * 60 * 60 * 1000;
  const s1 = new Date(start1Iso).getTime() - bufferMs;
  const e1 = new Date(end1Iso).getTime() + bufferMs;
  const s2 = new Date(start2Iso).getTime();
  const e2 = new Date(end2Iso).getTime();

  return s1 < e2 && e1 > s2;
}

/**
 * Detects physical venue collisions for proposed draft events against active scheduled events.
 */
export function detectVenueCollision(
  proposed: ProposedEventVenue,
  activeEvents: ExistingEventGeo[],
): VenueCollisionWarning {
  for (const existing of activeEvents) {
    if (proposed.excludeEventId && existing.id === proposed.excludeEventId) {
      continue;
    }

    const isTimeOverlap = isTimeWindowOverlapping(
      proposed.startTimeIso,
      proposed.endTimeIso,
      existing.startTimeIso,
      existing.endTimeIso,
    );

    if (!isTimeOverlap) continue;

    const distance = calculateHaversineDistanceMeters(
      proposed.latitude,
      proposed.longitude,
      existing.latitude,
      existing.longitude,
    );

    if (distance <= COLLISION_DISTANCE_THRESHOLD_METERS) {
      return {
        hasConflict: true,
        conflictingEventId: existing.id,
        conflictingEventTitle: existing.title,
        conflictingClubName: existing.clubName,
        distanceMeters: distance,
        warningMessage: `Warning: The ${existing.clubName} is hosting an event ("${existing.title}") at this exact location at this exact time (${distance}m away). Please coordinate with them or change your venue.`,
      };
    }
  }

  return { hasConflict: false };
}
