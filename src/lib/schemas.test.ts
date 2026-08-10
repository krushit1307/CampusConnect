import { describe, it, expect } from "vitest";
import {
  profileSchema,
  AVATAR_THEMES,
  HANDLE_UNAVAILABLE_MESSAGE,
  normalizeProfileHandle,
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./schemas";

describe("profileSchema", () => {
  const validPayload = {
    firstName: "Ada",
    lastName: "Lovelace",
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

  describe("firstName validation", () => {
    it("rejects an empty first name", () => {
      const result = profileSchema.safeParse({ ...validPayload, firstName: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("lastName validation", () => {
    it("rejects an empty last name", () => {
      const result = profileSchema.safeParse({ ...validPayload, lastName: "" });
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

    it("trims and limits handles before async uniqueness checks", () => {
      const result = profileSchema.safeParse({ ...validPayload, handle: "  clean_handle  " });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.handle).toBe("clean_handle");
      }

      expect(normalizeProfileHandle("  clean_handle  ")).toBe("clean_handle");
      expect(HANDLE_UNAVAILABLE_MESSAGE).toBe("This handle is already taken");
    });

    it("rejects handles longer than 30 characters", () => {
      const result = profileSchema.safeParse({ ...validPayload, handle: "a".repeat(31) });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.handle).toContain(
          "Handle must be 30 characters or fewer.",
        );
      }
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

  describe("avatarTheme validation", () => {
    it("accepts empty or missing avatarTheme", () => {
      const result1 = profileSchema.safeParse({ ...validPayload, avatarTheme: "" });
      const result2 = profileSchema.safeParse({ ...validPayload, avatarTheme: undefined });
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it("accepts each predefined gradient id", () => {
      for (const theme of AVATAR_THEMES) {
        const result = profileSchema.safeParse({ ...validPayload, avatarTheme: theme.id });
        expect(result.success).toBe(true);
      }
    });

    it("rejects a gradient id that isn't one of the predefined themes", () => {
      const result = profileSchema.safeParse({ ...validPayload, avatarTheme: "galaxy" });
      expect(result.success).toBe(false);
    });
  });
});

describe("signInSchema", () => {
  const validPayload = { email: "ada@college.edu", password: "hunter2" };

  it("accepts a valid payload", () => {
    expect(signInSchema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects a missing email", () => {
    const result = signInSchema.safeParse({ ...validPayload, email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = signInSchema.safeParse({ ...validPayload, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain(
        "Please enter a valid email address.",
      );
    }
  });

  it("rejects a missing password", () => {
    const result = signInSchema.safeParse({ ...validPayload, password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain("Password is required.");
    }
  });
});

describe("signUpSchema", () => {
  const validPayload = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@college.edu",
    password: "Password1",
    confirmPassword: "Password1",
  };

  it("accepts a fully valid payload", () => {
    expect(signUpSchema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects an empty first or last name", () => {
    expect(signUpSchema.safeParse({ ...validPayload, firstName: "" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...validPayload, lastName: "" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = signUpSchema.safeParse({ ...validPayload, email: "invalid" });
    expect(result.success).toBe(false);
  });

  describe("password strength", () => {
    it("rejects passwords shorter than 8 characters", () => {
      const result = signUpSchema.safeParse({
        ...validPayload,
        password: "Ab1",
        confirmPassword: "Ab1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toContain(
          "Password must be at least 8 characters.",
        );
      }
    });

    it("rejects passwords without a letter", () => {
      const result = signUpSchema.safeParse({
        ...validPayload,
        password: "12345678",
        confirmPassword: "12345678",
      });
      expect(result.success).toBe(false);
    });

    it("rejects passwords without a number", () => {
      const result = signUpSchema.safeParse({
        ...validPayload,
        password: "Password",
        confirmPassword: "Password",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("password confirmation", () => {
    it("rejects mismatched passwords", () => {
      const result = signUpSchema.safeParse({
        ...validPayload,
        confirmPassword: "Different1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.confirmPassword).toContain(
          "Passwords do not match.",
        );
      }
    });
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "ada@college.edu" }).success).toBe(true);
  });

  it("rejects an empty email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain(
        "Please enter a valid email address.",
      );
    }
  });
});

describe("resetPasswordSchema", () => {
  const validPayload = { password: "Password1", confirmPassword: "Password1" };

  it("accepts a valid payload", () => {
    expect(resetPasswordSchema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects a weak password", () => {
    const result = resetPasswordSchema.safeParse({
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      ...validPayload,
      confirmPassword: "Different1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain(
        "Passwords do not match.",
      );
    }
  });
});
