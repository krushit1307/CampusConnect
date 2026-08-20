/**
 * src/lib/timezone.ts
 *
 * Extended for Issue #3680 — Dynamic "Multi-Campus" Timezone Converter.
 *
 * Existing helpers (getUserTimeZone, parseUtcToLocal, formatEventInTimeZone)
 * are preserved unchanged. New helpers below add:
 *
 *   - getTimeZoneAbbreviation(tz)     → "BST", "EDT", "IST", ...
 *   - areTimeZonesDifferent(a, b)     → true if user-facing labels differ
 *   - formatDualClockEventTime(...)  → { local, venue, isDualClock, ... }
 */

import { formatInTimeZone } from "date-fns-tz";

/**
 * Gets the current user's local timezone from browser Intl API, defaulting to 'UTC'.
 */
export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Safely parses a UTC timestamp string into a Date instance.
 */
export function parseUtcToLocal(
  dateInput: string | Date | null | undefined,
  targetTimeZone?: string,
): Date | null {
  if (!dateInput) return null;
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return null;
  void targetTimeZone;
  return date;
}

/**
 * Formats a Date or UTC timestamp string into a formatted string in the target timezone.
 */
export function formatEventInTimeZone(
  dateInput: string | Date | null | undefined,
  formatStr: string,
  targetTimeZone?: string,
): string {
  if (!dateInput) return "";
  const timeZone = targetTimeZone || getUserTimeZone();
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return "";
  return formatInTimeZone(date, timeZone, formatStr);
}

// ────────────────────────────────────────────────────────────────────
// NEW HELPERS (Issue #3680)
// ────────────────────────────────────────────────────────────────────

/**
 * Returns the short abbreviation for a timezone at the given instant,
 * e.g. "Europe/London" → "BST" (in summer) or "GMT" (in winter).
 */
export function getTimeZoneAbbreviation(
  timeZone: string,
  atDate: Date | string | number = new Date(),
): string {
  const date = typeof atDate === "string" ? new Date(atDate) : new Date(atDate);
  if (Number.isNaN(date.getTime())) return timeZone;

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value || timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * True if the two IANA tz produce visibly different wall-clock times
 * at the given instant (DST-aware).
 */
export function areTimeZonesDifferent(
  tzA: string,
  tzB: string,
  atDate: Date | string = new Date(),
): boolean {
  if (!tzA || !tzB) return false;
  if (tzA === tzB) return false;
  const date = typeof atDate === "string" ? new Date(atDate) : atDate;
  if (Number.isNaN(date.getTime())) return tzA !== tzB;
  const fmt = "yyyy-MM-dd HH:mm";
  return formatInTimeZone(date, tzA, fmt) !== formatInTimeZone(date, tzB, fmt);
}

export interface DualClockEventTime {
  localStart: string;
  localEnd: string;
  venueStart: string;
  venueEnd: string;
  venueTimeZone: string;
  venueTzAbbrev: string;
  userTimeZone: string;
  userTzAbbrev: string;
  isDualClock: boolean;
  relativeDayHint: string | null;
  startUtcIso: string;
  endUtcIso: string | null;
}

const TIME_FMT = "h:mm a";
const DAY_FMT = "EEE, MMM d";

/**
 * Produces everything the <EventDualClockTime> component needs.
 *
 * Resolution order for venue tz:
 *   1. event.venue_timezone (set by trigger / RPC) — preferred.
 *   2. 'UTC' fallback.
 */
export function formatDualClockEventTime(
  event: {
    start_date?: string | null;
    end_date?: string | null;
    event_date?: string | null;
    venue_timezone?: string | null;
  },
  userTimeZone?: string,
): DualClockEventTime | null {
  const startInput = event.start_date || event.event_date;
  if (!startInput) return null;

  const start = new Date(startInput);
  if (Number.isNaN(start.getTime())) return null;

  const end = event.end_date ? new Date(event.end_date) : null;

  const userTz = userTimeZone || getUserTimeZone();
  const venueTz = event.venue_timezone || "UTC";

  const userTzAbbrev = getTimeZoneAbbreviation(userTz, start);
  const venueTzAbbrev = getTimeZoneAbbreviation(venueTz, start);

  const localStart = formatInTimeZone(start, userTz, TIME_FMT);
  const localEnd = end ? formatInTimeZone(end, userTz, TIME_FMT) : "";
  const venueStart = formatInTimeZone(start, venueTz, TIME_FMT);
  const venueEnd = end ? formatInTimeZone(end, venueTz, TIME_FMT) : "";

  const isDualClock = areTimeZonesDifferent(userTz, venueTz, start);

  let relativeDayHint: string | null = null;
  if (isDualClock) {
    const userDay = formatInTimeZone(start, userTz, DAY_FMT);
    const venueDay = formatInTimeZone(start, venueTz, DAY_FMT);
    if (userDay !== venueDay) {
      const userMs = new Date(
        formatInTimeZone(start, userTz, "yyyy-MM-dd'T'HH:mm:ss"),
      ).getTime();
      const venueMs = new Date(
        formatInTimeZone(start, venueTz, "yyyy-MM-dd'T'HH:mm:ss"),
      ).getTime();
      const diffHours = (venueMs - userMs) / 3_600_000;
      if (diffHours > 12) relativeDayHint = "next day";
      else if (diffHours < -12) relativeDayHint = "previous day";
    }
  }

  return {
    localStart, localEnd, venueStart, venueEnd,
    venueTimeZone: venueTz, venueTzAbbrev,
    userTimeZone: userTz, userTzAbbrev,
    isDualClock, relativeDayHint,
    startUtcIso: start.toISOString(),
    endUtcIso: end ? end.toISOString() : null,
  };
}
