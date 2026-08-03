import { z } from "zod";
export declare const TITLE_MAX_LENGTH = 100;
export declare const eventFormSchema: z.ZodEffects<
  z.ZodObject<
    {
      title: z.ZodString;
      description: z.ZodString;
      category: z.ZodOptional<z.ZodString>;
      location: z.ZodOptional<z.ZodString>;
      startDate: z.ZodString;
      endDate: z.ZodString;
      banner: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>>;
      capacity: z.ZodUnion<[z.ZodOptional<z.ZodNumber>, z.ZodLiteral<"">]>;
      faqs: z.ZodDefault<
        z.ZodOptional<
          z.ZodArray<
            z.ZodObject<
              {
                question: z.ZodString;
                answer: z.ZodString;
              },
              "strip",
              z.ZodTypeAny,
              {
                question: string;
                answer: string;
              },
              {
                question: string;
                answer: string;
              }
            >,
            "many"
          >
        >
      >;
    },
    "strip",
    z.ZodTypeAny,
    {
      title: string;
      description: string;
      startDate: string;
      endDate: string;
      faqs: {
        question: string;
        answer: string;
      }[];
      location?: string | undefined;
      banner?: string | undefined;
      category?: string | undefined;
      capacity?: number | "" | undefined;
    },
    {
      title: string;
      description: string;
      startDate: string;
      endDate: string;
      location?: string | undefined;
      banner?: string | undefined;
      category?: string | undefined;
      capacity?: number | "" | undefined;
      faqs?:
        | {
            question: string;
            answer: string;
          }[]
        | undefined;
    }
  >,
  {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    faqs: {
      question: string;
      answer: string;
    }[];
    location?: string | undefined;
    banner?: string | undefined;
    category?: string | undefined;
    capacity?: number | "" | undefined;
  },
  {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    location?: string | undefined;
    banner?: string | undefined;
    category?: string | undefined;
    capacity?: number | "" | undefined;
    faqs?:
      | {
          question: string;
          answer: string;
        }[]
      | undefined;
  }
>;
export type EventFormValues = z.infer<typeof eventFormSchema>;
/**
 * Returns true when endDate is strictly after startDate.
 * Both arguments are any value accepted by the Date constructor.
 */
export declare function isEndAfterStart(startDate: string, endDate: string): boolean;
/**
 * Returns true when the given date string represents a date in the past
 * relative to `now` (defaults to the current time).
 */
export declare function isPastDate(dateString: string, now?: Date): boolean;
/**
 * Formats a pair of ISO date strings into a human-readable event range.
 * e.g. "July 11, 2026 at 10:00 AM – 12:00 PM"
 */
export declare function formatEventDateRange(
  startIso: string,
  endIso: string,
  timeZone?: string,
): string;
export declare function parseCoordinates(locationStr: string): {
  isCoordinates: boolean;
  isValid: boolean;
  lat?: number;
  lng?: number;
};
export declare function matchesDateFilter(
  dateStr: string | null | undefined,
  filterType: "all" | "this-week" | "next-month" | "specific",
  specificDate?: Date,
  now?: Date,
): boolean;
