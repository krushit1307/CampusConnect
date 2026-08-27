// src/lib/eventFormSchema.ts
import { z } from "zod";

/**
 * Schema for a single Ticket Tier.
 * Includes validation for pricing, capacity, and early bird date restrictions.
 */
export const ticketTierSchema = z
  .object({
    id: z.string().optional(), // Present if editing an existing tier
    name: z
      .string()
      .min(2, "Tier name must be at least 2 characters")
      .max(50, "Tier name is too long"),
    price: z.number().min(0, "Price cannot be negative").max(99999, "Price exceeds maximum limit"),
    capacity: z
      .number()
      .int("Capacity must be a whole number")
      .min(1, "Capacity must be at least 1")
      .max(100000, "Capacity exceeds venue limits"),
    description: z.string().max(200).optional(),
    isEarlyBird: z.boolean().default(false),
    earlyBirdEndDate: z.date().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // If marked as early bird, an end date is strictly required
      if (data.isEarlyBird && !data.earlyBirdEndDate) {
        return false;
      }
      return true;
    },
    {
      message: "Early bird tiers require an end date",
      path: ["earlyBirdEndDate"],
    },
  )
  .refine(
    (data) => {
      // Early bird end date must be in the future (if creating) or before event start
      if (data.isEarlyBird && data.earlyBirdEndDate) {
        return data.earlyBirdEndDate > new Date();
      }
      return true;
    },
    {
      message: "Early bird end date must be in the future",
      path: ["earlyBirdEndDate"],
    },
  );

export type TicketTier = z.infer<typeof ticketTierSchema>;

/**
 * Master schema for the Event Creation/Edit form.
 * Wraps the ticket tiers array and enforces global validation rules.
 */
export const eventFormSchema = z
  .object({
    title: z.string().min(3, "Event title is required").max(100),
    description: z.string().min(20, "Please provide a more detailed description"),
    location: z.string().min(3, "Location is required"),
    startDate: z.date({
      required_error: "Start date is required",
    }),
    endDate: z.date({
      required_error: "End date is required",
    }),
    tags: z.array(z.string()).default([]), // <-- NEW ADDITION: Enables tags in the form state
    tickets: z
      .array(ticketTierSchema)
      .min(1, "You must create at least one ticket tier")
      .max(20, "Maximum 20 ticket tiers allowed")
      .refine(
        (tiers) => {
          // Enforce unique tier names (case-insensitive)
          const names = tiers.map((t) => t.name.trim().toLowerCase());
          return new Set(names).size === names.length;
        },
        {
          message: "Ticket tier names must be unique",
          path: ["tickets"], // Attaches error to the array level
        },
      ),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export type EventFormData = z.infer<typeof eventFormSchema>;
