import { z } from "zod";

export const TITLE_MAX_LENGTH = 100;

export const eventFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required.")
      .max(TITLE_MAX_LENGTH, `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`),
    description: z.string().trim().min(1, "Description is required."),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "End date must be after the start date.",
    path: ["endDate"],
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;

/**
 * Returns true when endDate is strictly after startDate.
 * Both arguments are any value accepted by the Date constructor.
 */
export function isEndAfterStart(startDate: string, endDate: string): boolean {
  return new Date(endDate) > new Date(startDate);
}

/**
 * Returns true when the given date string represents a date in the past
 * relative to `now` (defaults to the current time).
 */
export function isPastDate(dateString: string, now: Date = new Date()): boolean {
  return new Date(dateString) < now;
}

/**
 * Formats a pair of ISO date strings into a human-readable event range.
 * e.g. "July 11, 2026 at 10:00 AM – 12:00 PM"
 */
export function formatEventDateRange(startIso: string, endIso: string, timeZone = "UTC"): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  });

  const timeFmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });

  return `${dateFmt.format(start)} at ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}
