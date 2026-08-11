import { z } from "zod";

export const userSettingsSchema = z.object({
  theme: z.string().default("dark"),
  email_notifications: z.boolean().default(true),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

/**
 * Validates and parses user settings JSONB data, enforcing strict boolean and string types.
 */
export function parseUserSettings(input: unknown): UserSettings {
  const result = userSettingsSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  return {
    theme: "dark",
    email_notifications: true,
  };
}
