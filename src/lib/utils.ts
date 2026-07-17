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
