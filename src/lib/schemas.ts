import { z } from "zod";

// Predefined brand gradients users can pick as a fallback avatar background
// when they choose not to upload a custom profile picture. Defined once here
// so the settings UI and the validation schema always agree on valid ids.
export const AVATAR_THEMES = [
  {
    id: "sunset",
    label: "Sunset",
    gradient: "bg-gradient-to-br from-orange-400 via-pink-500 to-red-500",
  },
  {
    id: "ocean",
    label: "Ocean",
    gradient: "bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600",
  },
  {
    id: "forest",
    label: "Forest",
    gradient: "bg-gradient-to-br from-lime-400 via-emerald-500 to-green-700",
  },
  {
    id: "candy",
    label: "Candy",
    gradient: "bg-gradient-to-br from-pink-300 via-fuchsia-400 to-purple-500",
  },
  {
    id: "lava",
    label: "Lava",
    gradient: "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-700",
  },
] as const;

export type AvatarThemeId = (typeof AVATAR_THEMES)[number]["id"];

const avatarThemeIds = AVATAR_THEMES.map((theme) => theme.id) as [
  AvatarThemeId,
  ...AvatarThemeId[],
];

export const profileSchema = z.object({
  avatarTheme: z.enum(avatarThemeIds).optional().or(z.literal("")),
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
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
