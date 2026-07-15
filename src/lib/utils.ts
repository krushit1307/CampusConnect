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
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (dateString: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  };

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  const formattedDate = new Intl.DateTimeFormat("en-US", dateOptions).format(date);
  const formattedTime = new Intl.DateTimeFormat("en-US", timeOptions).format(date);

  return `${formattedDate} at ${formattedTime}`;
};

export function getGoogleCalendarUrl(event: {
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
}): string | null {
  if (!event.event_date) return null;

  const startDate = new Date(event.event_date);
  if (isNaN(startDate.getTime())) return null;

  // Default duration to 1 hour
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatUtcDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const dates = `${formatUtcDate(startDate)}/${formatUtcDate(endDate)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: dates,
  });

  if (event.description) {
    params.append("details", event.description);
  }

  if (event.location) {
    params.append("location", event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
