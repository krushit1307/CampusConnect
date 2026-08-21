import { type ClassValue } from "clsx";
export declare function cn(...inputs: ClassValue[]): string;
/**
 * Formats a date string into a human-readable format.
 *
 * Converts a valid date string into the format:
 * "Month Day, Year at HH:MM AM/PM".
 * Returns an empty string for empty input and the original
 * string if the provided date is invalid.
 *
 * @param dateString - The date string to format.
 * @returns A formatted date string, the original input if invalid,
 * or an empty string if no value is provided.
 */
export declare const formatDate: (dateString: string) => string;
export declare function getCountdown(dateStr: string): string;
/**
 * Formats a date string into a UTC date-only format.
 *
 * @param dateString - The date string to format.
 * @param monthFormat - The month format to use: "short" (default) or "long".
 * @returns A formatted date-only string, the original input if invalid,
 * or an empty string if no value is provided.
 */
export declare const formatDateOnly: (dateString: string, monthFormat?: "short" | "long") => string;
export declare function formatEventDateRange(event: {
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
}): string;
export declare function getGoogleCalendarUrl(event: {
  title: string;
  description: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
}): string | null;
export declare function getIcsContent(event: {
  title: string;
  description: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
}): string | null;
export declare function getMultiIcsContent(
  events: {
    title: string;
    description: string | null;
    event_date: string | null;
    start_date?: string | null;
    end_date?: string | null;
    location: string | null;
  }[],
): string | null;
