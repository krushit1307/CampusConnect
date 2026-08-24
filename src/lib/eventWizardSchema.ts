// src/lib/eventWizardSchema.ts
import { z } from "zod";

/**
 * Step 1: Basic Info
 * Title, description, category, and tags.
 */
export const basicsStepSchema = z.object({
  title: z
    .string()
    .min(3, "Event title must be at least 3 characters")
    .max(100, "Event title is too long"),
  description: z
    .string()
    .min(20, "Please provide a more detailed description (at least 20 characters)")
    .max(5000, "Description is too long (max 5000 characters)"),
  category: z.string().min(1, "Please select a category").max(50, "Category is too long"),
  tags: z.array(z.string().min(1).max(30)).max(10, "Maximum 10 tags allowed").default([]),
});
export type BasicsStepData = z.infer<typeof basicsStepSchema>;

/**
 * Step 2: Date & Location
 * Start/end dates and physical/virtual location.
 */
export const dateLocationStepBaseSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  location: z.string().min(3, "Location is required").max(200, "Location is too long"),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isVirtual: z.boolean().default(false),
  meetingUrl: z.string().url("Please enter a valid meeting URL").optional().or(z.literal("")),
  isOutdoor: z.boolean().default(false),
  hasPhotography: z.boolean().default(false),
  backupIndoorVenue: z.string().optional(),
  capacity: z
    .number()
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1")
    .max(100000, "Capacity exceeds venue limits"),
});

export const dateLocationStepSchema = dateLocationStepBaseSchema
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end > start;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      // If the event is virtual, a meeting URL is required.
      if (data.isVirtual && !data.meetingUrl) return false;
      return true;
    },
    {
      message: "Virtual events require a meeting URL",
      path: ["meetingUrl"],
    },
  );
export type DateLocationStepData = z.infer<typeof dateLocationStepSchema>;

/**
 * Step 3: Ticketing
 * Whether the event is paid, and if so, the ticket tiers.
 */
export const ticketTierSchema = z.object({
  id: z.string().optional(),
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
  earlyBirdEndDate: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type TicketTier = z.infer<typeof ticketTierSchema>;

export const ticketingStepBaseSchema = z.object({
  isPaid: z.boolean().default(false),
  isResumeRequired: z.boolean().default(false),
  tickets: z.array(ticketTierSchema).max(20, "Maximum 20 ticket tiers allowed").default([]),
});

export const ticketingStepSchema = ticketingStepBaseSchema
  .refine(
    (data) => {
      // Paid events must have at least one ticket tier.
      if (data.isPaid && data.tickets.length === 0) return false;
      return true;
    },
    {
      message: "Paid events must have at least one ticket tier",
      path: ["tickets"],
    },
  )
  .refine(
    (data) => {
      // Tier names must be unique (case-insensitive).
      if (data.tickets.length === 0) return true;
      const names = data.tickets.map((t) => t.name.trim().toLowerCase());
      return new Set(names).size === names.length;
    },
    {
      message: "Ticket tier names must be unique",
      path: ["tickets"],
    },
  )
  .refine(
    (data) => {
      // Early bird tiers must have an end date.
      for (const t of data.tickets) {
        if (t.isEarlyBird && !t.earlyBirdEndDate) return false;
      }
      return true;
    },
    {
      message: "Early bird tiers require an end date",
      path: ["tickets"],
    },
  );
export type TicketingStepData = z.infer<typeof ticketingStepSchema>;

/**
 * Step 4: Customizations
 * Cover image, banner color, and additional event settings.
 */
export const customizationsStepSchema = z.object({
  coverImageUrl: z
    .string()
    .url("Please enter a valid cover image URL")
    .optional()
    .or(z.literal("")),
  bannerColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Please enter a valid hex color (e.g. #6366f1)")
    .default("#6366f1"),
  isFeatured: z.boolean().default(false),
  allowWaitlist: z.boolean().default(true),
  sendReminderEmails: z.boolean().default(true),
  isLiveAlbumActive: z.boolean().default(false),
});
export type CustomizationsStepData = z.infer<typeof customizationsStepSchema>;

/**
 * Master schema — aggregates all four steps.
 * Used for final validation before submission to Supabase.
 *
 * This is intentionally the intersection of the four step schemas,
 * so that any field validated per-step is also validated at submission
 * time. The per-step schemas are stricter (e.g. cross-field rules like
 * "end date > start date"), and those refinements are re-applied here.
 */
export const eventWizardMasterSchema = z
  .object({
    // Basics
    title: basicsStepSchema.shape.title,
    description: basicsStepSchema.shape.description,
    category: basicsStepSchema.shape.category,
    tags: basicsStepSchema.shape.tags,
    // Date & Location
    startDate: dateLocationStepBaseSchema.shape.startDate,
    endDate: dateLocationStepBaseSchema.shape.endDate,
    location: dateLocationStepBaseSchema.shape.location,
    latitude: dateLocationStepBaseSchema.shape.latitude,
    longitude: dateLocationStepBaseSchema.shape.longitude,
    isVirtual: dateLocationStepBaseSchema.shape.isVirtual,
    meetingUrl: dateLocationStepBaseSchema.shape.meetingUrl,
    isOutdoor: dateLocationStepBaseSchema.shape.isOutdoor,
    hasPhotography: dateLocationStepBaseSchema.shape.hasPhotography,
    backupIndoorVenue: dateLocationStepBaseSchema.shape.backupIndoorVenue,
    capacity: dateLocationStepBaseSchema.shape.capacity,
    // Ticketing
    isPaid: ticketingStepBaseSchema.shape.isPaid,
    isResumeRequired: ticketingStepBaseSchema.shape.isResumeRequired,
    tickets: ticketingStepBaseSchema.shape.tickets,
    // Customizations
    coverImageUrl: customizationsStepSchema.shape.coverImageUrl,
    bannerColor: customizationsStepSchema.shape.bannerColor,
    isFeatured: customizationsStepSchema.shape.isFeatured,
    allowWaitlist: customizationsStepSchema.shape.allowWaitlist,
    sendReminderEmails: customizationsStepSchema.shape.sendReminderEmails,
    isLiveAlbumActive: customizationsStepSchema.shape.isLiveAlbumActive,
  })
  // Cross-field refinement: end date > start date.
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end > start;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    },
  )
  // Cross-field refinement: virtual events require a meeting URL.
  .refine(
    (data) => {
      if (data.isVirtual && !data.meetingUrl) return false;
      return true;
    },
    {
      message: "Virtual events require a meeting URL",
      path: ["meetingUrl"],
    },
  )
  // Cross-field refinement: paid events need at least one ticket tier.
  .refine(
    (data) => {
      if (data.isPaid && data.tickets.length === 0) return false;
      return true;
    },
    {
      message: "Paid events must have at least one ticket tier",
      path: ["tickets"],
    },
  )
  // Cross-field refinement: unique ticket tier names.
  .refine(
    (data) => {
      if (data.tickets.length === 0) return true;
      const names = data.tickets.map((t) => t.name.trim().toLowerCase());
      return new Set(names).size === names.length;
    },
    {
      message: "Ticket tier names must be unique",
      path: ["tickets"],
    },
  );

export type EventWizardFormData = z.infer<typeof eventWizardMasterSchema>;

/**
 * The wizard steps, in order. Used by the Stepper component and by
 * the store to know how many steps there are.
 */
export const WIZARD_STEPS = [
  { id: "basics", label: "Basic Info", schema: basicsStepSchema },
  { id: "date-location", label: "Date & Location", schema: dateLocationStepSchema },
  { id: "ticketing", label: "Ticketing", schema: ticketingStepSchema },
  { id: "customizations", label: "Customizations", schema: customizationsStepSchema },
  { id: "review", label: "Review & Submit", schema: null }, // no per-step schema
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

/**
 * The default / empty form data. Used to initialise the Zustand store
 * and to reset the wizard after a successful submission.
 */
export const DEFAULT_EVENT_WIZARD_DATA: EventWizardFormData = {
  title: "",
  description: "",
  category: "",
  tags: [],
  startDate: "",
  endDate: "",
  location: "",
  latitude: null,
  longitude: null,
  isVirtual: false,
  meetingUrl: "",
  isOutdoor: false,
  hasPhotography: false,
  backupIndoorVenue: "",
  capacity: 50,
  isPaid: false,
  isResumeRequired: false,
  tickets: [],
  coverImageUrl: "",
  bannerColor: "#6366f1",
  isFeatured: false,
  allowWaitlist: true,
  sendReminderEmails: true,
  isLiveAlbumActive: false,
};
