import { describe, it, expect } from "vitest";
import { profileSchema } from "./schemas";

describe("profileSchema", () => {
  const validPayload = {
    fullName: "Ada Lovelace",
    handle: "ada_lovelace",
    collegeEmail: "ada@college.edu",
    bio: "Systems programming, tea, and long walks.",
    linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
    phoneNumber: "+1 (555) 019-9234",
  };

  it("accepts a fully valid payload", () => {
    const result = profileSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  describe("fullName validation", () => {
    it("accepts a name with 2 characters", () => {
      const result = profileSchema.safeParse({ ...validPayload, fullName: "Ab" });
      expect(result.success).toBe(true);
    });

    it("rejects a name with less than 2 characters", () => {
      const result = profileSchema.safeParse({ ...validPayload, fullName: "A" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.fullName).toContain(
          "Full name must be at least 2 characters long.",
        );
      }
    });

    it("rejects an empty name", () => {
      const result = profileSchema.safeParse({ ...validPayload, fullName: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("handle validation", () => {
    it("accepts alphanumeric handles with underscores", () => {
      const result = profileSchema.safeParse({ ...validPayload, handle: "user_name_123" });
      expect(result.success).toBe(true);
    });

    it("rejects handles with less than 2 characters", () => {
      const result = profileSchema.safeParse({ ...validPayload, handle: "a" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.handle).toContain(
          "Handle must be at least 2 characters long.",
        );
      }
    });

    it("rejects handles containing special characters other than underscores", () => {
      const result1 = profileSchema.safeParse({ ...validPayload, handle: "user@name" });
      const result2 = profileSchema.safeParse({ ...validPayload, handle: "user.name" });
      const result3 = profileSchema.safeParse({ ...validPayload, handle: "user-name" });
      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
    });
  });

  describe("collegeEmail validation", () => {
    it("accepts a valid email address", () => {
      const result = profileSchema.safeParse({ ...validPayload, collegeEmail: "test@domain.com" });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid email format", () => {
      const result = profileSchema.safeParse({ ...validPayload, collegeEmail: "invalid-email" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.collegeEmail).toContain(
          "Please enter a valid email address.",
        );
      }
    });
  });

  describe("bio validation", () => {
    it("accepts empty or missing bio", () => {
      const result1 = profileSchema.safeParse({ ...validPayload, bio: "" });
      const result2 = profileSchema.safeParse({ ...validPayload, bio: undefined });
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it("accepts a bio of 160 characters", () => {
      const result = profileSchema.safeParse({ ...validPayload, bio: "a".repeat(160) });
      expect(result.success).toBe(true);
    });

    it("rejects a bio longer than 160 characters", () => {
      const result = profileSchema.safeParse({ ...validPayload, bio: "a".repeat(161) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.bio).toContain(
          "Bio must be 160 characters or fewer.",
        );
      }
    });
  });

  describe("linkedinUrl validation", () => {
    it("accepts empty or missing linkedinUrl", () => {
      const result1 = profileSchema.safeParse({ ...validPayload, linkedinUrl: "" });
      const result2 = profileSchema.safeParse({ ...validPayload, linkedinUrl: undefined });
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it("accepts a valid HTTP/HTTPS URL", () => {
      const result1 = profileSchema.safeParse({
        ...validPayload,
        linkedinUrl: "https://linkedin.com",
      });
      const result2 = profileSchema.safeParse({
        ...validPayload,
        linkedinUrl: "http://linkedin.com",
      });
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it("rejects a URL without protocol", () => {
      const result = profileSchema.safeParse({
        ...validPayload,
        linkedinUrl: "linkedin.com/in/ada",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.linkedinUrl).toContain(
          "Please enter a valid URL (include http:// or https://).",
        );
      }
    });
  });

  describe("phoneNumber validation", () => {
    it("accepts empty or missing phoneNumber", () => {
      const result1 = profileSchema.safeParse({ ...validPayload, phoneNumber: "" });
      const result2 = profileSchema.safeParse({ ...validPayload, phoneNumber: undefined });
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it("accepts valid phone patterns", () => {
      const patterns = ["1234567890", "+11234567890", "123-456-7890", "(123) 456-7890"];
      for (const pattern of patterns) {
        const result = profileSchema.safeParse({ ...validPayload, phoneNumber: pattern });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid characters in phone numbers", () => {
      const result = profileSchema.safeParse({ ...validPayload, phoneNumber: "123-456-789a" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.phoneNumber).toContain(
          "Please enter a valid phone number (minimum 10 digits).",
        );
      }
    });

    it("rejects phone numbers that are too short", () => {
      const result = profileSchema.safeParse({ ...validPayload, phoneNumber: "1234567" });
      expect(result.success).toBe(false);
    });
  });
});
