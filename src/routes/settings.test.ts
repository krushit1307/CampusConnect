import { describe, it, expect } from "vitest";
import { ProfileUpdateAllowlistSchema } from "@/lib/schemas";

describe("Mass Assignment Defense Suite (#2147)", () => {
  it("rejects payload when unauthorized administrative fields are injected", () => {
    const maliciousPayload = {
      first_name: "Jane",
      last_name: "Doe",
      handle: "janedoe",
      bio: "Software developer",
      // Injected mass assignment payload
      role: "admin",
      is_admin: true,
      permissions: ["*"],
    };

    // Strict Zod schema throws an error due to unmapped properties
    expect(() => ProfileUpdateAllowlistSchema.parse(maliciousPayload)).toThrow();
  });

  it("successfully parses valid profile updates", () => {
    const validPayload = {
      first_name: "Jane",
      last_name: "Doe",
      handle: "janedoe",
      bio: "Software developer",
      skills: ["React", "TypeScript"],
    };

    const parsed = ProfileUpdateAllowlistSchema.parse(validPayload);
    expect(parsed.first_name).toBe("Jane");
    expect(parsed.skills).toEqual(["React", "TypeScript"]);
  });
});
