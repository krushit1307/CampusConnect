import { z } from "zod";

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters long."),
  handle: z
    .string()
    .trim()
    .min(2, "Handle must be at least 2 characters long.")
    .regex(/^[a-zA-Z0-9_]+$/, "Handle can only contain letters, numbers, and underscores."),
  collegeEmail: z.string().trim().email("Please enter a valid email address."),
  bio: z
    .string()
    .trim()
    .max(160, "Bio must be 160 characters or fewer.")
    .optional()
    .or(z.literal("")),
  linkedinUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      if (!val) return true;
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    }, "Please enter a valid URL (include http:// or https://)."),
  phoneNumber: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      if (!val) return true;
      return /^\+?[0-9\s\-()]{10,20}$/.test(val);
    }, "Please enter a valid phone number (minimum 10 digits)."),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
