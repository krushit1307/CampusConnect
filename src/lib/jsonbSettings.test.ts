import { describe, it, expect } from "vitest";
import { parseUserSettings, userSettingsSchema } from "./jsonbSettings";

describe("userSettingsSchema & parseUserSettings", () => {
  it("accepts valid settings with boolean email_notifications and string theme", () => {
    const valid = { theme: "light", email_notifications: false };
    const parsed = userSettingsSchema.parse(valid);
    expect(parsed).toEqual({ theme: "light", email_notifications: false });
  });

  it("rejects string values for email_notifications", () => {
    const invalid = { theme: "dark", email_notifications: "true_string" };
    const res = userSettingsSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects non-string values for theme", () => {
    const invalid = { theme: 123, email_notifications: true };
    const res = userSettingsSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("parseUserSettings returns safe fallback default values for malformed input", () => {
    const malformed = { theme: "dark", email_notifications: "maybe" };
    const result = parseUserSettings(malformed);
    expect(result).toEqual({ theme: "dark", email_notifications: true });
  });
});
