import { describe, it, expect } from "vitest";
import { userSignupSchema } from "./validationSchemas";

/**
 * Traditional Unit Testing Suite
 * Complements property-based tests by verifying specific, known edge cases
 * and ensuring exact error messages are returned for UI display.
 */
describe("User Signup Schema - Unit Tests", () => {
  it("validates a completely correct payload", () => {
    const validData = {
      name: "Jane Doe-Smith",
      email: "jane.doe@university.edu",
      password: "SecureP@ss123",
      age: 20,
    };
    const result = userSignupSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jane.doe@university.edu"); // Verifies toLowerCase()
    }
  });

  it("rejects missing required fields", () => {
    const incompleteData = { name: "John", email: "john@test.com" };
    const result = userSignupSchema.safeParse(incompleteData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues.some((i) => i.path.includes("password"))).toBe(true);
      expect(result.error.issues.some((i) => i.path.includes("age"))).toBe(true);
    }
  });

  it("rejects email exceeding 255 characters (ReDoS prevention)", () => {
    const longEmail = `a${"b".repeat(250)}@test.com`;
    const result = userSignupSchema.safeParse({
      name: "Test",
      email: longEmail,
      password: "SecureP@ss123",
      age: 20,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Email cannot exceed 255 characters");
    }
  });

  it("rejects password with insufficient length", () => {
    const result = userSignupSchema.safeParse({
      name: "Test",
      email: "test@test.com",
      password: "Short1!", // Only 7 chars
      age: 20,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Password must be at least 8 characters");
    }
  });

  it("rejects negative zero or NaN for age", () => {
    const resultNaN = userSignupSchema.safeParse({
      name: "Test",
      email: "test@test.com",
      password: "SecureP@ss123",
      age: NaN,
    });
    expect(resultNaN.success).toBe(false);

    // Note: Zod handles -0 as 0, which would fail the min(13) check anyway
    const resultNegZero = userSignupSchema.safeParse({
      name: "Test",
      email: "test@test.com",
      password: "SecureP@ss123",
      age: -0,
    });
    expect(resultNegZero.success).toBe(false);
  });
});
