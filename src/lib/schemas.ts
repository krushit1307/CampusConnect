import { z } from "zod";

// --- Database Native Enums (#2020) -------------------------------------------

export const UserRoleEnum = z.enum(["student", "faculty", "admin", "moderator"]);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const EventStatusEnum = z.enum(["draft", "published", "cancelled"]);
export type EventStatus = z.infer<typeof EventStatusEnum>;

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
  role: UserRoleEnum.default("student"),
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

export const notificationPreferencesSchema = z.object({
  email_alerts: z.boolean().default(true),
  push_notifications: z.boolean().default(true),
  digest: z.boolean().default(true),
  dark_mode_default: z.boolean().default(false),
});

export type NotificationPreferencesValues = z.infer<typeof notificationPreferencesSchema>;

// --- Auth: sign in ---------------------------------------------------------

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type SignInFormValues = z.infer<typeof signInSchema>;

// --- Auth: sign up ----------------------------------------------------------

// Shared so the "new password" rules stay identical between sign-up and the
// password-reset flow below.
const passwordRules = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter.")
  .regex(/[0-9]/, "Password must contain at least one number.");

export const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required."),
    lastName: z.string().trim().min(1, "Last name is required."),
    role: UserRoleEnum.default("student"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Please enter a valid email address."),
    password: passwordRules,
    confirmPassword: z.string().min(1, "Please confirm your password."),
    newsletterOptIn: z.boolean().default(false),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignUpFormValues = z.infer<typeof signUpSchema>;

// --- Forgot password ---------------------------------------------------------

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

// --- Reset password ----------------------------------------------------------

export const resetPasswordSchema = z
  .object({
    password: passwordRules,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
