/**
 * Dynamic Commute Time RSVP Warning Service
 *
 * Provides spatial-temporal schedule intersection analysis during RSVP flow.
 * Calculates transit times between venues and issues proactive warnings if physical commute > schedule gap (#3942).
 */

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export type CommuteMode = "WALKING" | "BICYCLE" | "CAMPUS_SHUTTLE" | "DRIVING";

export interface ScheduledEventSummary {
  id: string;
  title: string;
  location: string;
  coordinates: GeoCoordinate;
  startDate: string; // ISO
  endDate: string; // ISO
}

export interface CommuteConflictAnalysis {
  hasConflict: boolean;
  targetEvent: ScheduledEventSummary;
  adjacentEvent: ScheduledEventSummary;
  relationship: "PRECEDING" | "SUCCEEDING";
  gapMinutes: number;
  transitDurationMinutes: number;
  timeDeficitMinutes: number; // e.g. 25 min walk - 10 min gap = 15 min deficit
  distanceKm: number;
  currentMode: CommuteMode;
  alternativeOptions: {
    mode: CommuteMode;
    durationMinutes: number;
    isFeasible: boolean;
    description: string;
  }[];
  warningMessage: string;
}

export class DynamicCommuteRsvpWarningService {
  // Speed heuristics (km/h)
  private static WALKING_SPEED_KMH = 4.8;
  private static BICYCLE_SPEED_KMH = 15.0;
  private static SHUTTLE_AVERAGE_KMH = 22.0;

  // Known campus venue coordinates dictionary
  private static venueCoordinatesMap: Record<string, GeoCoordinate> = {
    "North Campus Engineering Hall": { latitude: 41.7082, longitude: -86.2365 },
    "South Campus Arts Center": { latitude: 41.6934, longitude: -86.2389 },
    "Central Library Plaza": { latitude: 41.7015, longitude: -86.2358 },
    "Joyce Athletic Arena": { latitude: 41.698, longitude: -86.229 },
    "Duncan Student Center": { latitude: 41.6998, longitude: -86.236 },
    "Eck Visitors Center": { latitude: 41.6955, longitude: -86.2372 },
  };

  /**
   * Resolve coordinates for a venue name
   */
  static getVenueCoordinates(venueName: string): GeoCoordinate {
    if (this.venueCoordinatesMap[venueName]) {
      return this.venueCoordinatesMap[venueName];
    }
    // Fallback central campus
    return { latitude: 41.7, longitude: -86.235 };
  }

  /**
   * Haversine distance in kilometers
   */
  static calculateDistanceKm(coord1: GeoCoordinate, coord2: GeoCoordinate): number {
    const R = 6371; // Earth radius in km
    const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1.latitude * Math.PI) / 180) *
        Math.cos((coord2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(3));
  }

  /**
   * Calculate transit duration for a given mode including building ingress/egress buffer
   */
  static calculateTransitDurationMinutes(
    distanceKm: number,
    mode: CommuteMode = "WALKING",
    bufferMins = 3, // 3 min building exit/entry buffer
  ): number {
    if (distanceKm <= 0.05) return 1;

    let speedKmh = this.WALKING_SPEED_KMH;
    let modeBuffer = bufferMins;

    switch (mode) {
      case "BICYCLE":
        speedKmh = this.BICYCLE_SPEED_KMH;
        modeBuffer += 2; // bike locking/unlocking
        break;
      case "CAMPUS_SHUTTLE":
        speedKmh = this.SHUTTLE_AVERAGE_KMH;
        modeBuffer += 5; // shuttle wait time
        break;
      case "DRIVING":
        speedKmh = 25.0;
        modeBuffer += 6; // parking & walk from lot
        break;
      case "WALKING":
      default:
        speedKmh = this.WALKING_SPEED_KMH;
        break;
    }

    const travelHours = distanceKm / speedKmh;
    const travelMins = Math.ceil(travelHours * 60);
    return travelMins + modeBuffer;
  }

  /**
   * Analyzes potential commute conflict between an RSVP target event and user's schedule
   */
  static analyzeCommuteConflict(
    targetEvent: ScheduledEventSummary,
    existingRsvps: ScheduledEventSummary[],
    preferredMode: CommuteMode = "WALKING",
  ): CommuteConflictAnalysis | null {
    const targetStart = new Date(targetEvent.startDate).getTime();
    const targetEnd = new Date(targetEvent.endDate).getTime();

    // Find closest adjacent event within 60 minutes window
    let closestPreceding: { event: ScheduledEventSummary; gapMins: number } | null = null;
    let closestSucceeding: { event: ScheduledEventSummary; gapMins: number } | null = null;

    for (const event of existingRsvps) {
      if (event.id === targetEvent.id) continue;

      const eventStart = new Date(event.startDate).getTime();
      const eventEnd = new Date(event.endDate).getTime();

      // Check Preceding Event (ends before target starts)
      if (eventEnd <= targetStart) {
        const gapMins = Math.floor((targetStart - eventEnd) / (1000 * 60));
        if (gapMins <= 60) {
          if (!closestPreceding || gapMins < closestPreceding.gapMins) {
            closestPreceding = { event, gapMins };
          }
        }
      }

      // Check Succeeding Event (starts after target ends)
      if (eventStart >= targetEnd) {
        const gapMins = Math.floor((eventStart - targetEnd) / (1000 * 60));
        if (gapMins <= 60) {
          if (!closestSucceeding || gapMins < closestSucceeding.gapMins) {
            closestSucceeding = { event, gapMins };
          }
        }
      }
    }

    // Evaluate Preceding conflict first, then Succeeding
    const candidate = closestPreceding || closestSucceeding;
    if (!candidate) {
      return null; // No events within 60-min window
    }

    const relationship = candidate === closestPreceding ? "PRECEDING" : "SUCCEEDING";
    const adjacent = candidate.event;
    const gapMinutes = candidate.gapMins;

    const distanceKm = this.calculateDistanceKm(adjacent.coordinates, targetEvent.coordinates);

    const walkingDuration = this.calculateTransitDurationMinutes(distanceKm, "WALKING");
    const currentModeDuration = this.calculateTransitDurationMinutes(distanceKm, preferredMode);

    // Build alternative modes breakdown
    const bikeDuration = this.calculateTransitDurationMinutes(distanceKm, "BICYCLE");
    const shuttleDuration = this.calculateTransitDurationMinutes(distanceKm, "CAMPUS_SHUTTLE");

    const alternativeOptions = [
      {
        mode: "WALKING" as CommuteMode,
        durationMinutes: walkingDuration,
        isFeasible: walkingDuration <= gapMinutes,
        description: `Campus Walk (~${distanceKm} km)`,
      },
      {
        mode: "BICYCLE" as CommuteMode,
        durationMinutes: bikeDuration,
        isFeasible: bikeDuration <= gapMinutes,
        description: `Campus Bike / Lime Scooter (~${bikeDuration} mins)`,
      },
      {
        mode: "CAMPUS_SHUTTLE" as CommuteMode,
        durationMinutes: shuttleDuration,
        isFeasible: shuttleDuration <= gapMinutes,
        description: `Campus Express Route (~${shuttleDuration} mins including wait)`,
      },
    ];

    const hasConflict = currentModeDuration > gapMinutes;

    if (!hasConflict) {
      return null;
    }

    const timeDeficitMinutes = currentModeDuration - gapMinutes;
    const warningMessage =
      relationship === "PRECEDING"
        ? `Warning: It takes ${currentModeDuration} minutes to walk here from your previous event "${adjacent.title}", but you only have a ${gapMinutes}-minute gap. You will be late by ~${timeDeficitMinutes} minutes.`
        : `Warning: It takes ${currentModeDuration} minutes to travel to your next event "${adjacent.title}" after this, but you only have a ${gapMinutes}-minute gap. You will be late by ~${timeDeficitMinutes} minutes.`;

    return {
      hasConflict,
      targetEvent,
      adjacentEvent: adjacent,
      relationship,
      gapMinutes,
      transitDurationMinutes: currentModeDuration,
      timeDeficitMinutes,
      distanceKm,
      currentMode: preferredMode,
      alternativeOptions,
      warningMessage,
    };
  }

  /**
   * Log user's decision on a commute warning (for analytics & audit)
   */
  static logWarningDecision(
    userId: string,
    targetEventId: string,
    conflictingEventId: string,
    decision: "OVERRIDDEN" | "CANCELLED" | "SWITCHED_MODE",
    chosenMode: CommuteMode,
  ): { logged: boolean; timestamp: string } {
    console.log(
      `[CommuteWarningAudit] User ${userId} made decision '${decision}' (Mode: ${chosenMode}) for target event ${targetEventId} conflicting with ${conflictingEventId}`,
    );
    return {
      logged: true,
      timestamp: new Date().toISOString(),
    };
  }
}
