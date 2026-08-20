// src/lib/speakerItinerary.ts
// -----------------------------------------------------------------------------
// Issue #3753 — Automated Speaker Travel Itinerary & Arrival Buffer Coordination
//
// Pure travel-chain maths. No React, no Supabase — the buffer calculation is
// the whole feature, and it needs to be testable against awkward real journeys
// (an international connection with a 40-minute layover, a delayed first leg
// that cascades, a speaker landing after their own session starts).
//
// The one number that matters
//   buffer = call_time − projected_campus_arrival
//
// Everything else in this file exists to compute the right-hand side honestly:
// delays accumulate along the chain, an international arrival is not "wheels
// down" (immigration and baggage are real time), and a layover shorter than
// the mode's minimum connection time is a missed connection waiting to happen.
// -----------------------------------------------------------------------------

export type TravelMode =
  "flight_international" | "flight_domestic" | "rail" | "bus" | "car" | "ground_transfer";

export type ItineraryDirection = "inbound" | "outbound";

export interface ItineraryLeg {
  id: string;
  /** 1-based position in the journey. */
  sequence: number;
  mode: TravelMode;
  carrier?: string | null;
  reference?: string | null;
  origin: string;
  destination: string;
  scheduledDeparture: string; // ISO
  scheduledArrival: string; // ISO
  /** Reported delay on this leg, in minutes. Negative means running early. */
  delayMinutes: number;
}

export interface SpeakerItinerary {
  id: string;
  speakerName: string;
  direction: ItineraryDirection;
  /** When the speaker is due on site (not on stage — allow for briefing). */
  callTime: string; // ISO
  sessionTitle?: string | null;
  hostName?: string | null;
  /** Minutes from the final arrival point to campus. */
  groundTransferMinutes: number;
  legs: ItineraryLeg[];
}

// -----------------------------------------------------------------------------
// Mode characteristics
// -----------------------------------------------------------------------------

/**
 * Minimum time that must exist between arriving on one leg and departing on
 * the next for the connection to be realistic.
 *
 * Keyed by the *arriving* mode, because that is what determines how long it
 * takes to get off one vehicle and onto the next. A 40-minute layover looks
 * fine on a booking site and is a missed connection in an international
 * terminal.
 */
export const MINIMUM_CONNECTION_MINUTES: Record<TravelMode, number> = {
  flight_international: 90,
  flight_domestic: 45,
  rail: 20,
  bus: 15,
  car: 10,
  ground_transfer: 10,
};

/**
 * Time on the ground after arrival before onward travel can begin —
 * immigration, baggage reclaim, walking off a platform. This is the step
 * organisers reliably forget, and it is why a speaker who lands at 09:15 is
 * not in a taxi at 09:20.
 */
export const POST_ARRIVAL_PROCESSING_MINUTES: Record<TravelMode, number> = {
  flight_international: 60, // immigration + baggage
  flight_domestic: 25, // baggage
  rail: 10,
  bus: 5,
  car: 0,
  ground_transfer: 0,
};

export function modeLabel(mode: TravelMode): string {
  switch (mode) {
    case "flight_international":
      return "International flight";
    case "flight_domestic":
      return "Domestic flight";
    case "rail":
      return "Rail";
    case "bus":
      return "Bus";
    case "car":
      return "Car";
    case "ground_transfer":
      return "Ground transfer";
  }
}

// -----------------------------------------------------------------------------
// Chain validation
// -----------------------------------------------------------------------------

export type ItineraryProblemKind =
  | "no_legs"
  | "sequence_gap"
  | "time_reversal"
  | "location_mismatch"
  | "short_connection"
  | "invalid_timestamp";

export interface ItineraryProblem {
  kind: ItineraryProblemKind;
  message: string;
  /** Legs involved, by id, so the UI can highlight them. */
  legIds: string[];
  /** Only set for short_connection: how many minutes short it is. */
  shortfallMinutes?: number;
}

const MS_PER_MINUTE = 60_000;

function parseTime(iso: string): number {
  return new Date(iso).getTime();
}

function isValidTime(iso: string): boolean {
  return !Number.isNaN(parseTime(iso));
}

export function sortLegs(legs: ItineraryLeg[]): ItineraryLeg[] {
  return [...legs].sort((a, b) => a.sequence - b.sequence);
}

/**
 * Validates that the legs actually form a journey: sequential, forward in
 * time, geographically connected, and with survivable connections.
 *
 * Returns every problem found rather than the first, because an organiser
 * fixing an itinerary wants the whole list, not a game of whack-a-mole.
 */
export function validateItinerary(itinerary: SpeakerItinerary): ItineraryProblem[] {
  const problems: ItineraryProblem[] = [];
  const legs = sortLegs(itinerary.legs);

  if (legs.length === 0) {
    problems.push({
      kind: "no_legs",
      message: "No travel legs have been recorded for this speaker.",
      legIds: [],
    });
    return problems;
  }

  for (const leg of legs) {
    if (!isValidTime(leg.scheduledDeparture) || !isValidTime(leg.scheduledArrival)) {
      problems.push({
        kind: "invalid_timestamp",
        message: `Leg ${leg.sequence} (${leg.origin} → ${leg.destination}) has an unreadable departure or arrival time.`,
        legIds: [leg.id],
      });
      continue;
    }
    if (parseTime(leg.scheduledArrival) < parseTime(leg.scheduledDeparture)) {
      problems.push({
        kind: "time_reversal",
        message: `Leg ${leg.sequence} (${leg.origin} → ${leg.destination}) arrives before it departs.`,
        legIds: [leg.id],
      });
    }
  }

  // Sequence numbers must be contiguous from 1, or a leg has been lost.
  for (let i = 0; i < legs.length; i += 1) {
    if (legs[i].sequence !== i + 1) {
      problems.push({
        kind: "sequence_gap",
        message: `Leg numbering jumps to ${legs[i].sequence} where ${i + 1} was expected — a leg may be missing.`,
        legIds: [legs[i].id],
      });
      break;
    }
  }

  for (let i = 1; i < legs.length; i += 1) {
    const previous = legs[i - 1];
    const current = legs[i];

    if (!isValidTime(previous.scheduledArrival) || !isValidTime(current.scheduledDeparture)) {
      continue;
    }

    if (normaliseLocation(previous.destination) !== normaliseLocation(current.origin)) {
      problems.push({
        kind: "location_mismatch",
        message: `Leg ${previous.sequence} arrives at ${previous.destination} but leg ${current.sequence} departs from ${current.origin}.`,
        legIds: [previous.id, current.id],
      });
    }

    const layoverMinutes =
      (parseTime(current.scheduledDeparture) - parseTime(previous.scheduledArrival)) /
      MS_PER_MINUTE;

    if (layoverMinutes < 0) {
      problems.push({
        kind: "time_reversal",
        message: `Leg ${current.sequence} departs before leg ${previous.sequence} has arrived.`,
        legIds: [previous.id, current.id],
      });
      continue;
    }

    const required = MINIMUM_CONNECTION_MINUTES[previous.mode];
    if (layoverMinutes < required) {
      problems.push({
        kind: "short_connection",
        message: `Only ${Math.round(layoverMinutes)} minutes to connect at ${previous.destination}; a ${modeLabel(previous.mode).toLowerCase()} arrival needs at least ${required}.`,
        legIds: [previous.id, current.id],
        shortfallMinutes: Math.round(required - layoverMinutes),
      });
    }
  }

  return problems;
}

/** Airport/station codes are compared case- and whitespace-insensitively. */
function normaliseLocation(value: string): string {
  return value.trim().toLowerCase();
}

// -----------------------------------------------------------------------------
// Delay propagation & arrival projection
// -----------------------------------------------------------------------------

export interface ProjectedLeg extends ItineraryLeg {
  /** Scheduled departure plus all delay inherited from earlier legs. */
  projectedDeparture: string;
  projectedArrival: string;
  /** Delay carried into this leg from upstream, in minutes. */
  inheritedDelayMinutes: number;
  /** Total delay on arrival: inherited + this leg's own. */
  totalDelayMinutes: number;
  /** True when this leg's connection is no longer achievable. */
  connectionMissed: boolean;
}

/**
 * Walks the chain applying delays forward.
 *
 * A delay does not simply push every downstream leg by the same amount: a long
 * layover absorbs it. Only when the delay eats through the layover does it
 * propagate — and at that point the connection is missed, which is a far more
 * serious signal than "running 20 minutes late".
 */
export function projectLegs(itinerary: SpeakerItinerary): ProjectedLeg[] {
  const legs = sortLegs(itinerary.legs);
  const projected: ProjectedLeg[] = [];
  let carriedDelay = 0;

  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i];
    const scheduledDep = parseTime(leg.scheduledDeparture);
    const scheduledArr = parseTime(leg.scheduledArrival);

    if (Number.isNaN(scheduledDep) || Number.isNaN(scheduledArr)) {
      // Unreadable timestamps are reported by validateItinerary; here we just
      // pass the leg through untouched rather than producing NaN dates.
      projected.push({
        ...leg,
        projectedDeparture: leg.scheduledDeparture,
        projectedArrival: leg.scheduledArrival,
        inheritedDelayMinutes: carriedDelay,
        totalDelayMinutes: carriedDelay + leg.delayMinutes,
        connectionMissed: false,
      });
      continue;
    }

    let inherited = carriedDelay;
    let connectionMissed = false;

    if (i > 0) {
      const previous = projected[i - 1];
      const previousArrival = parseTime(previous.projectedArrival);
      const requiredConnection = MINIMUM_CONNECTION_MINUTES[legs[i - 1].mode];
      const availableMinutes = (scheduledDep - previousArrival) / MS_PER_MINUTE;

      if (availableMinutes >= requiredConnection) {
        // The layover absorbed the upstream delay entirely.
        inherited = 0;
      } else {
        connectionMissed = true;
        // The speaker misses this departure. The realistic recovery is the
        // next comparable service; without live schedule data the honest
        // model is "the shortfall becomes the delay".
        inherited = Math.max(0, requiredConnection - availableMinutes);
      }
    }

    const totalDelay = inherited + leg.delayMinutes;
    const projectedDeparture = new Date(scheduledDep + inherited * MS_PER_MINUTE);
    const projectedArrival = new Date(scheduledArr + totalDelay * MS_PER_MINUTE);

    projected.push({
      ...leg,
      projectedDeparture: projectedDeparture.toISOString(),
      projectedArrival: projectedArrival.toISOString(),
      inheritedDelayMinutes: Math.round(inherited),
      totalDelayMinutes: Math.round(totalDelay),
      connectionMissed,
    });

    carriedDelay = totalDelay;
  }

  return projected;
}

export type ArrivalRiskBand = "comfortable" | "tight" | "critical" | "will_miss";

export interface ArrivalProjection {
  itineraryId: string;
  speakerName: string;
  sessionTitle: string | null;
  /** Who is meeting them. Null when the handoff has no owner yet. */
  hostName: string | null;
  /** Final leg arrival, delays applied. */
  finalLegArrival: string | null;
  /** Minutes of immigration/baggage/platform egress after the final leg. */
  processingMinutes: number;
  groundTransferMinutes: number;
  /** When the speaker realistically reaches campus. */
  projectedCampusArrival: string | null;
  callTime: string;
  /** callTime − projectedCampusArrival, in minutes. Negative = late. */
  bufferMinutes: number | null;
  band: ArrivalRiskBand;
  problems: ItineraryProblem[];
  legs: ProjectedLeg[];
  /** Human-readable reason this itinerary is flagged, or null when it is fine. */
  flagReason: string | null;
}

/**
 * Buffer thresholds in minutes. Travel goes wrong in units of half an hour,
 * so "comfortable" starts at 90 rather than at any positive number.
 */
export const BUFFER_THRESHOLDS = {
  comfortable: 90,
  tight: 30,
} as const;

export function bandForBuffer(bufferMinutes: number): ArrivalRiskBand {
  if (bufferMinutes < 0) return "will_miss";
  if (bufferMinutes >= BUFFER_THRESHOLDS.comfortable) return "comfortable";
  if (bufferMinutes >= BUFFER_THRESHOLDS.tight) return "tight";
  return "critical";
}

export function bandLabel(band: ArrivalRiskBand): string {
  switch (band) {
    case "comfortable":
      return "Comfortable";
    case "tight":
      return "Tight";
    case "critical":
      return "Critical";
    case "will_miss":
      return "Will miss session";
  }
}

/**
 * The headline calculation: does this person physically reach campus before
 * they are due, and with how much margin?
 */
export function projectArrival(itinerary: SpeakerItinerary): ArrivalProjection {
  const problems = validateItinerary(itinerary);
  const legs = projectLegs(itinerary);

  const base: ArrivalProjection = {
    itineraryId: itinerary.id,
    speakerName: itinerary.speakerName,
    sessionTitle: itinerary.sessionTitle ?? null,
    hostName: itinerary.hostName ?? null,
    finalLegArrival: null,
    processingMinutes: 0,
    groundTransferMinutes: itinerary.groundTransferMinutes,
    projectedCampusArrival: null,
    callTime: itinerary.callTime,
    bufferMinutes: null,
    band: "critical",
    problems,
    legs,
    flagReason: null,
  };

  if (legs.length === 0) {
    return {
      ...base,
      flagReason: "No travel legs recorded — arrival cannot be projected.",
    };
  }

  const finalLeg = legs[legs.length - 1];
  const finalArrivalMs = parseTime(finalLeg.projectedArrival);
  const callTimeMs = parseTime(itinerary.callTime);

  if (Number.isNaN(finalArrivalMs) || Number.isNaN(callTimeMs)) {
    return {
      ...base,
      flagReason: "Arrival cannot be projected: the itinerary contains an unreadable time.",
    };
  }

  const processingMinutes = POST_ARRIVAL_PROCESSING_MINUTES[finalLeg.mode];
  const campusArrivalMs =
    finalArrivalMs +
    (processingMinutes + Math.max(0, itinerary.groundTransferMinutes)) * MS_PER_MINUTE;

  const bufferMinutes = Math.round((callTimeMs - campusArrivalMs) / MS_PER_MINUTE);
  const band = bandForBuffer(bufferMinutes);

  return {
    ...base,
    finalLegArrival: finalLeg.projectedArrival,
    processingMinutes,
    projectedCampusArrival: new Date(campusArrivalMs).toISOString(),
    bufferMinutes,
    band,
    flagReason: buildFlagReason(band, bufferMinutes, legs, problems),
  };
}

function buildFlagReason(
  band: ArrivalRiskBand,
  bufferMinutes: number,
  legs: ProjectedLeg[],
  problems: ItineraryProblem[],
): string | null {
  const missed = legs.find((l) => l.connectionMissed);
  if (missed) {
    return `Connection to leg ${missed.sequence} (${missed.origin} → ${missed.destination}) is no longer achievable.`;
  }

  if (band === "will_miss") {
    return `Projected to reach campus ${formatDuration(Math.abs(bufferMinutes))} after the call time.`;
  }

  const shortConnection = problems.find((p) => p.kind === "short_connection");
  if (shortConnection) return shortConnection.message;

  if (band === "critical") {
    return `Only ${formatDuration(bufferMinutes)} of margin — any delay makes this late.`;
  }

  if (band === "tight") {
    return `${formatDuration(bufferMinutes)} of margin, with no room for a missed connection.`;
  }

  const otherProblem = problems[0];
  return otherProblem ? otherProblem.message : null;
}

/**
 * Sorts a set of itineraries so the organiser sees the person most likely to
 * miss their own session first.
 */
export function sortByRisk(projections: ArrivalProjection[]): ArrivalProjection[] {
  const BAND_ORDER: Record<ArrivalRiskBand, number> = {
    will_miss: 0,
    critical: 1,
    tight: 2,
    comfortable: 3,
  };

  return [...projections].sort((a, b) => {
    const byBand = BAND_ORDER[a.band] - BAND_ORDER[b.band];
    if (byBand !== 0) return byBand;
    // Within a band, the smaller buffer is the more urgent.
    const aBuffer = a.bufferMinutes ?? Number.NEGATIVE_INFINITY;
    const bBuffer = b.bufferMinutes ?? Number.NEGATIVE_INFINITY;
    if (aBuffer !== bBuffer) return aBuffer - bBuffer;
    return a.speakerName.localeCompare(b.speakerName);
  });
}

// -----------------------------------------------------------------------------
// Presentation helpers
// -----------------------------------------------------------------------------

export function formatDuration(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatBuffer(bufferMinutes: number | null): string {
  if (bufferMinutes === null) return "Unknown";
  if (bufferMinutes < 0) return `${formatDuration(bufferMinutes)} late`;
  return `${formatDuration(bufferMinutes)} spare`;
}

/**
 * Breakdown of how the projected campus arrival was reached, so an organiser
 * can see *why* a 09:15 landing becomes an 11:05 campus arrival rather than
 * having to trust the number.
 */
export function explainArrival(projection: ArrivalProjection): string[] {
  const steps: string[] = [];
  const finalLeg = projection.legs[projection.legs.length - 1];
  if (!finalLeg) return steps;

  steps.push(
    `${modeLabel(finalLeg.mode)} arrives ${formatClock(finalLeg.projectedArrival)}${
      finalLeg.totalDelayMinutes > 0
        ? ` (${formatDuration(finalLeg.totalDelayMinutes)} delayed)`
        : ""
    }`,
  );

  if (projection.processingMinutes > 0) {
    const what =
      finalLeg.mode === "flight_international"
        ? "immigration and baggage"
        : finalLeg.mode === "flight_domestic"
          ? "baggage reclaim"
          : "leaving the platform";
    steps.push(`+ ${formatDuration(projection.processingMinutes)} for ${what}`);
  }

  if (projection.groundTransferMinutes > 0) {
    steps.push(`+ ${formatDuration(projection.groundTransferMinutes)} ground transfer to campus`);
  }

  if (projection.projectedCampusArrival) {
    steps.push(
      `= on campus ${formatClock(projection.projectedCampusArrival)}, due ${formatClock(projection.callTime)}`,
    );
  }

  return steps;
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
