import { describe, it, expect } from "vitest";
import {
  feedbackFormSchema,
  signupFormSchema,
  getFieldErrorProps,
  type FieldError,
} from "./formValidation";

describe("Form Validation Schemas & Accessibility Helpers (#2647)", () => {
  describe("feedbackFormSchema", () => {
    it("validates correct feedback submission payload", () => {
      const valid = {
        category: "bug",
        subject: "Map component zoom issue",
        message: "When zooming into the auditorium map, seat labels shrink unexpectedly.",
        email: "user@campus.edu",
      };

      const result = feedbackFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects invalid email or short message", () => {
      const invalid = {
        category: "bug",
        subject: "Hi",
        message: "Short",
        email: "not-an-email",
      };

      const result = feedbackFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        expect(fieldErrors.subject).toBeDefined();
        expect(fieldErrors.message).toBeDefined();
        expect(fieldErrors.email).toBeDefined();
      }
    });
  });

  describe("signupFormSchema", () => {
    it("validates correct user signup payload", () => {
      const valid = {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@university.edu",
        password: "Password123",
        confirmPassword: "Password123",
      };

      const result = signupFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects mismatched confirmPassword or weak password", () => {
      const invalid = {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@university.edu",
        password: "weak",
        confirmPassword: "differentPassword",
      };

      const result = signupFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        expect(fieldErrors.password).toBeDefined();
        expect(fieldErrors.confirmPassword).toBeDefined();
      }
    });
  });

  describe("getFieldErrorProps accessibility helper", () => {
    it("returns aria-invalid false when field has no error", () => {
      const props = getFieldErrorProps("email");
      expect(props["aria-invalid"]).toBe(false);
    });

    it("returns role=alert and aria-describedby when error exists", () => {
      const mockError: FieldError = {
        type: "required",
        message: "Email is required",
      };
      const props = getFieldErrorProps("email", mockError);

      expect(props["aria-invalid"]).toBe(true);
      expect(props["aria-describedby"]).toBe("email-error");
      expect(props.role).toBe("alert");
    });
  });
});
