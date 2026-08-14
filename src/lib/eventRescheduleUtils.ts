/**
 * Event Reschedule Utilities (#2326)
 * Handles drag-and-drop timestamp calculations while strictly preventing Timezone Drift.
 */

export interface RescheduleTimestampResult {
  /** Updated start date with original hours/minutes preserved */
  newStart: Date;
  /** Updated end date with original duration & hours/minutes preserved */
  newEnd: Date;
  /** ISO 8601 string for start date payload */
  startIso: string;
  /** ISO 8601 string for end date payload */
  endIso: string;
  /** Human-readable formatted string for toasts (e.g., "Saturday, Aug 16 at 4:00 PM") */
  formattedLabel: string;
}

/**
 * Strictly preserves the original Hours, Minutes, Seconds, and Milliseconds of a Date/timestamp
 * while mutating ONLY the Year, Month, and Day components to match the drag target date.
 *
 * Prevents timezone offset drift when dragging across days on client browsers.
 */
export function preserveTimeAndMutateDate(
  originalTimestamp: Date | string,
  newTargetDate: Date,
): Date {
  const orig =
    typeof originalTimestamp === "string" ? new Date(originalTimestamp) : originalTimestamp;

  const result = new Date(newTargetDate.getTime());

  // Mutate Year, Month, and Day to match the target date cell
  result.setFullYear(newTargetDate.getFullYear());
  result.setMonth(newTargetDate.getMonth());
  result.setDate(newTargetDate.getDate());

  // Strictly copy original Hours, Minutes, Seconds, and Milliseconds
  result.setHours(orig.getHours());
  result.setMinutes(orig.getMinutes());
  result.setSeconds(orig.getSeconds());
  result.setMilliseconds(orig.getMilliseconds());

  return result;
}

/**
 * Calculates updated start and end timestamps when an event is dragged and dropped to a new date cell.
 * Preserves event duration and original time of day.
 */
export function calculateRescheduledTimestamps(
  originalStart: Date | string,
  originalEnd: Date | string | undefined | null,
  newDroppedStart: Date,
): RescheduleTimestampResult {
  const origStart = typeof originalStart === "string" ? new Date(originalStart) : originalStart;
  const origEnd = originalEnd
    ? typeof originalEnd === "string"
      ? new Date(originalEnd)
      : originalEnd
    : new Date(origStart.getTime() + 60 * 60 * 1000); // Default 1 hr duration

  const eventDurationMs = origEnd.getTime() - origStart.getTime();

  // Combine target date with original start hours/minutes
  const newStart = preserveTimeAndMutateDate(origStart, newDroppedStart);
  const newEnd = new Date(newStart.getTime() + Math.max(15 * 60 * 1000, eventDurationMs));

  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  const formattedLabel = `${newStart.toLocaleDateString("en-US", options)}`;

  return {
    newStart,
    newEnd,
    startIso: newStart.toISOString(),
    endIso: newEnd.toISOString(),
    formattedLabel,
  };
}

/**
 * Formats event time range for tooltips and calendar popovers
 */
export function formatTimeRange(start: Date, end: Date): string {
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
}
