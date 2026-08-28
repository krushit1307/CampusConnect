/**
 * Calculates distance between two coordinates in kilometers using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates distance in miles.
 */
export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const km = calculateHaversineDistanceKm(lat1, lon1, lat2, lon2);
  return km * 0.621371;
}

/**
 * Campus walking speed heuristic: 3.1 mph (approx 5.0 km/h or ~83.3 meters/min).
 * Returns estimated travel time in minutes.
 */
export function calculateWalkingTimeMinutes(
  distanceKm: number,
  walkingSpeedKmH: number = 4.8,
): number {
  if (distanceKm <= 0) return 0;
  const hours = distanceKm / walkingSpeedKmH;
  return Math.ceil(hours * 60);
}

export interface AdjacentEvent {
  id: string;
  title: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_date: string;
  end_date?: string | null;
}

export interface CommuteConflict {
  adjacentEvent: AdjacentEvent;
  conflictType: "before" | "after";
  temporalGapMinutes: number;
  distanceMiles: number;
  distanceKm: number;
  estimatedTravelMinutes: number;
  warningMessage: string;
}

/**
 * Evaluates whether a new event RSVP conflicts with adjacent same-day registered events.
 */
export function detectCommuteConflict(
  targetEvent: {
    id: string;
    title: string;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    start_date: string;
    end_date?: string | null;
  },
  otherEvents: AdjacentEvent[],
): CommuteConflict | null {
  if (!targetEvent.latitude || !targetEvent.longitude) {
    return null;
  }

  const targetStart = new Date(targetEvent.start_date).getTime();
  const targetEnd = targetEvent.end_date
    ? new Date(targetEvent.end_date).getTime()
    : targetStart + 60 * 60 * 1000;

  for (const other of otherEvents) {
    if (other.id === targetEvent.id) continue;
    if (!other.latitude || !other.longitude) continue;

    const otherStart = new Date(other.start_date).getTime();
    const otherEnd = other.end_date
      ? new Date(other.end_date).getTime()
      : otherStart + 60 * 60 * 1000;

    const distanceKm = calculateHaversineDistanceKm(
      targetEvent.latitude,
      targetEvent.longitude,
      other.latitude,
      other.longitude,
    );
    const distanceMiles = parseFloat((distanceKm * 0.621371).toFixed(1));
    const estimatedTravelMinutes = calculateWalkingTimeMinutes(distanceKm);

    // Case 1: Other event ends right before Target event starts
    // Temporal gap = targetStart - otherEnd
    if (targetStart >= otherEnd) {
      const gapMs = targetStart - otherEnd;
      const gapMinutes = Math.floor(gapMs / (60 * 1000));
      // Same day threshold (e.g., within 2 hours)
      if (gapMinutes <= 120 && estimatedTravelMinutes > gapMinutes) {
        return {
          adjacentEvent: other,
          conflictType: "before",
          temporalGapMinutes: gapMinutes,
          distanceMiles,
          distanceKm,
          estimatedTravelMinutes,
          warningMessage: `Warning: You only have ${gapMinutes} minute${gapMinutes === 1 ? "" : "s"} to travel ${distanceMiles} miles across campus from "${other.title}". You may be late to this event.`,
        };
      }
    }

    // Case 2: Target event ends right before Other event starts
    // Temporal gap = otherStart - targetEnd
    if (otherStart >= targetEnd) {
      const gapMs = otherStart - targetEnd;
      const gapMinutes = Math.floor(gapMs / (60 * 1000));
      if (gapMinutes <= 120 && estimatedTravelMinutes > gapMinutes) {
        return {
          adjacentEvent: other,
          conflictType: "after",
          temporalGapMinutes: gapMinutes,
          distanceMiles,
          distanceKm,
          estimatedTravelMinutes,
          warningMessage: `Warning: You only have ${gapMinutes} minute${gapMinutes === 1 ? "" : "s"} to travel ${distanceMiles} miles across campus after this event to attend "${other.title}". You may be late to the next event.`,
        };
      }
    }
  }

  return null;
}
