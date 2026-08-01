import { toZonedTime, formatInTimeZone } from "date-fns-tz";

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
 * Safely parses a UTC timestamp string into a Date instance representing local or target timezone time.
 */
export function parseUtcToLocal(
  dateInput: string | Date | null | undefined,
  targetTimeZone?: string,
): Date | null {
  if (!dateInput) return null;
  const timeZone = targetTimeZone || getUserTimeZone();
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return null;
  return toZonedTime(date, timeZone);
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
