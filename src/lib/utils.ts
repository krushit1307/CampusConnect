import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInDays, isToday, isTomorrow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
export function getCountdown(dateStr: string): string {
  const eventDate = new Date(dateStr);

  if (isNaN(eventDate.getTime())) {
    return "";
  }

  const today = new Date();

  if (isToday(eventDate)) {
    return "Today!";
  }

  if (isTomorrow(eventDate)) {
    return "Tomorrow";
  }

  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);

  const days = differenceInDays(eventDate, today);

  if (days < 0) {
    return "Ended";
  }

  if (days < 30) {
    return `In ${days} day${days > 1 ? "s" : ""}`;
  }

  const months = Math.floor(days / 30);

  return `In ${months} month${months > 1 ? "s" : ""}`;
}

/**
 * Formats a date string into a UTC date-only format.
 *
 * @param dateString - The date string to format.
 * @param monthFormat - The month format to use: "short" (default) or "long".
 * @returns A formatted date-only string, the original input if invalid,
 * or an empty string if no value is provided.
 */
export const formatDateOnly = (
  dateString: string,
  monthFormat: "short" | "long" = "short",
): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: monthFormat,
    day: "numeric",
    timeZone: "UTC",
  });
};

export function formatEventDateRange(event: {
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
}): string {
  const startValue = event.start_date || event.event_date;

  if (!startValue) return "Date TBA";

  if (!event.end_date) {
    return formatDate(startValue);
  }

  const startDate = new Date(startValue);
  const endDate = new Date(event.end_date);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return formatDate(startValue);
  }

  const sameDay = startDate.toDateString() === endDate.toDateString();

  if (!sameDay) {
    return `${formatDate(startValue)} – ${formatDate(event.end_date)}`;
  }

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${dateFormatter.format(startDate)} at ${timeFormatter.format(startDate)} – ${timeFormatter.format(endDate)}`;
}

export function getGoogleCalendarUrl(event: {
  title: string;
  description: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
}): string | null {
  const startValue = event.start_date || event.event_date;

  if (!startValue) return null;

  const startDate = new Date(startValue);
  if (isNaN(startDate.getTime())) return null;

  const endDate = event.end_date
    ? new Date(event.end_date)
    : new Date(startDate.getTime() + 60 * 60 * 1000);

  if (isNaN(endDate.getTime())) return null;

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
