import { format, formatDistanceToNow, parseISO } from "date-fns";

/**
 * Safely converts string or Date inputs into a valid Date object.
 */
function toDate(dateInput: string | Date | number): Date {
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === "string") return parseISO(dateInput);
  return new Date(dateInput);
}

/**
 * Formats a timestamp into a relative time string (e.g., '2 hours ago', 'in 3 days').
 */
export function formatRelativeTime(dateInput: string | Date | number): string {
  try {
    const date = toDate(dateInput);
    if (isNaN(date.getTime())) return "";
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
}

/**
 * Formats a timestamp into a standard readable date string (e.g., 'October 12, 2026').
 */
export function formatStandardDate(
  dateInput: string | Date | number,
  pattern = "MMMM d, yyyy",
): string {
  try {
    const date = toDate(dateInput);
    if (isNaN(date.getTime())) return "";
    return format(date, pattern);
  } catch {
    return "";
  }
}
