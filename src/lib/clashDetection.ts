export interface ExistingEvent {
  id: string;
  title: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  locationId: string;
  category?: string;
}

export interface ProposedEvent {
  startTime: string; // ISO String
  endTime: string; // ISO String
  locationId: string;
  category?: string;
  excludeEventId?: string;
}

export type ClashSeverity = "HARD" | "SOFT" | "NONE";

export interface ClashEvaluationResult {
  hasClash: boolean;
  severity: ClashSeverity;
  hardClashes: ExistingEvent[];
  softClashes: ExistingEvent[];
  message?: string;
}

/**
 * Evaluates whether two ISO timestamp intervals overlap.
 */
export function areIntervalsOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();

  return aStart < bEnd && aEnd > bStart;
}

/**
 * Detects hard (same room/location) and soft (same target category) clashes against existing events.
 */
export function evaluateEventClashes(
  proposed: ProposedEvent,
  existingEvents: ExistingEvent[],
): ClashEvaluationResult {
  const hardClashes: ExistingEvent[] = [];
  const softClashes: ExistingEvent[] = [];

  for (const event of existingEvents) {
    if (proposed.excludeEventId && event.id === proposed.excludeEventId) {
      continue;
    }

    const isOverlapping = areIntervalsOverlapping(
      proposed.startTime,
      proposed.endTime,
      event.startTime,
      event.endTime,
    );

    if (isOverlapping) {
      if (event.locationId === proposed.locationId) {
        hardClashes.push(event);
      } else if (proposed.category && event.category === proposed.category) {
        softClashes.push(event);
      }
    }
  }

  if (hardClashes.length > 0) {
    return {
      hasClash: true,
      severity: "HARD",
      hardClashes,
      softClashes,
      message: `Hard Clash: Room/location is already reserved by ${hardClashes[0].title}. Please choose a different venue or time slot.`,
    };
  }

  if (softClashes.length > 0) {
    return {
      hasClash: true,
      severity: "SOFT",
      hardClashes,
      softClashes,
      message: `Warning: ${softClashes.length} other ${proposed.category} event(s) scheduled during this time slot.`,
    };
  }

  return {
    hasClash: false,
    severity: "NONE",
    hardClashes: [],
    softClashes: [],
  };
}
