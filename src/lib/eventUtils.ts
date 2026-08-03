import { z } from "zod";
import { format } from "date-fns";
import {
  startOfWeek,
  endOfWeek,
  addMonths,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isWithinInterval,
} from "date-fns";

export const TITLE_MAX_LENGTH = 100;

export const eventFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required.")
      .max(TITLE_MAX_LENGTH, `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`),
    description: z.string().trim().min(1, "Description is required."),
    category: z.string().trim().min(1, "Category is required."),
    location: z.string().trim().optional(),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
    banner: z.union([z.literal(""), z.string().url("Must be a valid URL")]).optional(),
    capacity: z.coerce
      .number()
      .int()
      .positive("Capacity must be positive")
      .optional()
      .or(z.literal("")),
    isPrivate: z.boolean().optional().default(false),
    faqs: z
      .array(
        z.object({
          question: z.string().trim().min(1, "Question is required."),
          answer: z.string().trim().min(1, "Answer is required."),
        }),
      )
      .optional()
      .default([]),
    tags: z.array(z.string()).optional().default([]),
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

export function parseCoordinates(locationStr: string): {
  isCoordinates: boolean;
  isValid: boolean;
  lat?: number;
  lng?: number;
} {
  const trimmed = locationStr.trim();
  const parts = trimmed.split(",");

  if (parts.length === 2) {
    const latStr = parts[0].trim();
    const lngStr = parts[1].trim();

    // Check if at least one part is numeric, indicating coordinates were intended
    const numericRegex = /^-?\d+(\.\d+)?$/;
    if (numericRegex.test(latStr) || numericRegex.test(lngStr)) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);

      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { isCoordinates: true, isValid: false };
      }
      return { isCoordinates: true, isValid: true, lat, lng };
    }
  }
  return { isCoordinates: false, isValid: true };
}

export type FaqEntry = { question: string; answer: string };

export function hasDraftContent(values: EventFormValues): boolean {
  return Boolean(
    values.title?.trim() ||
    values.description?.trim() ||
    values.location?.trim() ||
    values.startDate ||
    values.endDate ||
    (values.faqs && values.faqs.length > 0),
  );
}

export function eventFormToDbPayload(
  values: EventFormValues & { requiresApproval?: boolean },
  userId: string,
  clubId: string | null,
) {
  const startDateIso = new Date(values.startDate).toISOString();
  const endDateIso = new Date(values.endDate).toISOString();

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    category_id: values.category || null,
    location: values.location?.trim() || null,
    start_date: startDateIso,
    end_date: endDateIso,
    event_date: startDateIso,
    created_by: userId,
    club_id: clubId,
    requires_approval: values.requiresApproval || false,
    tags: values.tags || [],
  };
}

export function parseFlyerDate(dateStr: string): { startDate: string; endDate: string } | null {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return {
      startDate: `${format(d, "yyyy-MM-dd")}T12:00`,
      endDate: `${format(d, "yyyy-MM-dd")}T14:00`,
    };
  } catch {
    return null;
  }
}

export function applyDateRangeSelection(
  range: { from?: Date | undefined; to?: Date | undefined } | undefined,
  currentStartStr: string,
  currentEndStr: string,
): { startDate: string; endDate: string } {
  if (!range) return { startDate: "", endDate: "" };

  const existingStartTime =
    currentStartStr && currentStartStr.includes("T") ? currentStartStr.split("T")[1] : "00:00";
  const startDate = range.from ? `${format(range.from, "yyyy-MM-dd")}T${existingStartTime}` : "";

  let endDate = "";
  if (range.to) {
    const existingEndTime =
      currentEndStr && currentEndStr.includes("T") ? currentEndStr.split("T")[1] : "23:59";
    endDate = `${format(range.to, "yyyy-MM-dd")}T${existingEndTime}`;
  }

  return { startDate, endDate };
}

export function updateTimeInDate(dateStr: string, time: string): string {
  if (!dateStr) return dateStr;
  const datePart = dateStr.split("T")[0];
  return `${datePart}T${time}`;
}

export function addFaq(faqs: FaqEntry[]): FaqEntry[] {
  return [...faqs, { question: "", answer: "" }];
}

export function removeFaq(faqs: FaqEntry[], index: number): FaqEntry[] {
  return faqs.filter((_: unknown, i: number) => i !== index);
}

export function updateFaq(
  faqs: FaqEntry[],
  index: number,
  field: keyof FaqEntry,
  value: string,
): FaqEntry[] {
  const updated = [...faqs];
  updated[index] = { ...updated[index], [field]: value };
  return updated;
}

export function matchesDateFilter(
  dateStr: string | null | undefined,
  filterType: "all" | "this-week" | "next-month" | "specific",
  specificDate?: Date,
  now = new Date(),
): boolean {
  if (filterType === "all") return true;
  if (!dateStr) return false;
  const eventDate = new Date(dateStr);

  if (filterType === "this-week") {
    const start = startOfWeek(now);
    const end = endOfWeek(now);
    return isWithinInterval(eventDate, { start, end });
  }
  if (filterType === "next-month") {
    const nextMonth = addMonths(now, 1);
    const start = startOfMonth(nextMonth);
    const end = endOfMonth(nextMonth);
    return isWithinInterval(eventDate, { start, end });
  }
  if (filterType === "specific" && specificDate) {
    return isSameDay(eventDate, specificDate);
  }
  return true;
}
