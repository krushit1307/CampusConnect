import {
  format,
  formatDistanceToNow,
  parseISO,
  isLeapYear as fnsIsLeapYear,
  differenceInCalendarDays,
  isSameDay as fnsIsSameDay,
  isToday as fnsIsToday,
  isYesterday as fnsIsYesterday,
  isTomorrow as fnsIsTomorrow,
} from "date-fns";

export interface FormatEventDateOptions {
  pattern?: string;
  includeTime?: boolean;
  timeZone?: string;
  fallback?: string;
}

/**
 * Safely converts string, Date, or millisecond timestamp inputs into a valid Date object.
 */
export function toDate(dateInput: string | Date | number | null | undefined): Date | null {
  if (dateInput === null || dateInput === undefined || dateInput === "") return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === "number") {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;

    let processed = trimmed;
    // Check if it looks like a date/time string but lacks timezone offset indicators
    // We look for ISO date-time formats, e.g. YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    // and check if it doesn't end with Z or a timezone offset like +HH:MM or -HH:MM.
    if (
      /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)?$/.test(trimmed) &&
      !trimmed.endsWith("Z") &&
      !/[+-]\d{2}:?\d{2}$/.test(trimmed)
    ) {
      // Append 'Z' to treat it as UTC if it contains hour/minute info
      if (trimmed.includes(":") || trimmed.includes("T")) {
        processed = trimmed.includes(" ") ? `${trimmed.replace(" ", "T")}Z` : `${trimmed}Z`;
      }
    }

    // First try ISO parse
    const parsed = parseISO(processed);
    if (!isNaN(parsed.getTime())) return parsed;

    // Fallback to standard JS Date parse
    const fallbackDate = new Date(processed);
    if (!isNaN(fallbackDate.getTime())) return fallbackDate;
  }

  return null;
}

/**
 * Formats a timestamp into a relative time string (e.g., '2 hours ago', 'Yesterday', 'in 3 days').
 */
export function formatRelativeTime(
  dateInput: string | Date | number | null | undefined,
  baseDate?: Date | number,
): string {
  try {
    const date = toDate(dateInput);
    if (!date) return "";

    const reference = baseDate
      ? baseDate instanceof Date
        ? baseDate
        : new Date(baseDate)
      : undefined;

    if (fnsIsToday(date)) {
      return formatDistanceToNow(date, {
        addSuffix: true,
        ...(reference ? { comparisonDate: reference } : {}),
      });
    }
    if (reference && fnsIsYesterday(date)) {
      return "Yesterday";
    }
    if (reference && fnsIsTomorrow(date)) {
      return "Tomorrow";
    }

    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
}

/**
 * Formats a timestamp into a standard readable date string (e.g., 'October 12, 2026').
 */
export function formatStandardDate(
  dateInput: string | Date | number | null | undefined,
  pattern = "MMMM d, yyyy",
): string {
  try {
    const date = toDate(dateInput);
    if (!date) return "";
    return format(date, pattern);
  } catch {
    return "";
  }
}

/**
 * Formats event dates with custom patterns, fallback text, and optional time inclusions.
 */
export function formatEventDate(
  dateInput: string | Date | number | null | undefined,
  options: FormatEventDateOptions = {},
): string {
  const { pattern = "MMM d, yyyy", includeTime = false, timeZone, fallback = "Date TBA" } = options;

  const date = toDate(dateInput);
  if (!date) return fallback;

  try {
    if (timeZone) {
      return formatTimezoneAdjustedDate(
        date,
        timeZone,
        includeTime ? `${pattern} 'at' h:mm a z` : pattern,
      );
    }

    const formatPattern = includeTime ? `${pattern} 'at' h:mm a` : pattern;
    return format(date, formatPattern);
  } catch {
    return fallback;
  }
}

/**
 * Formats a date range spanning single-day or multi-day event schedules.
 */
export function formatEventDateRange(
  startInput: string | Date | number | null | undefined,
  endInput?: string | Date | number | null | undefined,
  options: { pattern?: string; timeZone?: string } = {},
): string {
  const startDate = toDate(startInput);
  if (!startDate) return "Date TBA";

  const endDate = toDate(endInput);
  const pattern = options.pattern || "MMMM d, yyyy";

  if (!endDate) {
    return formatEventDate(startDate, { pattern, includeTime: true, timeZone: options.timeZone });
  }

  const isSameCalendarDay = fnsIsSameDay(startDate, endDate);

  if (isSameCalendarDay) {
    const dayStr = format(startDate, pattern);
    const startTimeStr = format(startDate, "h:mm a");
    const endTimeStr = format(endDate, "h:mm a");
    return `${dayStr} from ${startTimeStr} to ${endTimeStr}`;
  }

  const startStr = format(startDate, `${pattern} 'at' h:mm a`);
  const endStr = format(endDate, `${pattern} 'at' h:mm a`);
  return `${startStr} – ${endStr}`;
}

/**
 * Determines if a given date falls in a leap year (e.g. Feb 29, 2024 / 2028).
 */
export function isLeapYearDate(dateInput: string | Date | number | null | undefined): boolean {
  const date = toDate(dateInput);
  if (!date) return false;
  return fnsIsLeapYear(date);
}

/**
 * Checks if a date falls exactly on a midnight boundary (00:00:00.000 or 23:59:59.999).
 */
export function isMidnightBoundary(dateInput: string | Date | number | null | undefined): boolean {
  const date = toDate(dateInput);
  if (!date) return false;

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  const isExactMidnight = hours === 0 && minutes === 0 && seconds === 0;
  const isEndMidnight = hours === 23 && minutes === 59 && seconds === 59;

  return isExactMidnight || isEndMidnight;
}

/**
 * Formats a date using Intl.DateTimeFormat for target IANA timezones (e.g. UTC, America/New_York, Asia/Kolkata).
 */
export function formatTimezoneAdjustedDate(
  dateInput: string | Date | number | null | undefined,
  timeZone: string,
  pattern = "MMMM d, yyyy, h:mm a z",
): string {
  const date = toDate(dateInput);
  if (!date) return "";

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
    return formatter.format(date);
  } catch {
    return formatStandardDate(date, pattern);
  }
}

/**
 * Calculates calendar day differences between two dates.
 */
export function getDaysDifference(
  startDateInput: string | Date | number | null | undefined,
  endDateInput: string | Date | number | null | undefined,
): number {
  const start = toDate(startDateInput);
  const end = toDate(endDateInput);

  if (!start || !end) return 0;
  return differenceInCalendarDays(end, start);
}

/**
 * Checks if two date inputs resolve to the same calendar day.
 */
export function isSameCalendarDay(
  dateA: string | Date | number | null | undefined,
  dateB: string | Date | number | null | undefined,
): boolean {
  const d1 = toDate(dateA);
  const d2 = toDate(dateB);

  if (!d1 || !d2) return false;
  return fnsIsSameDay(d1, d2);
}
