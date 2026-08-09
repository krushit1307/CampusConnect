import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { userSignupSchema } from "./validationSchemas";

/**
 * Property-Based Testing Suite
 * Uses fast-check to generate thousands of random, hostile inputs to verify
 * that the Zod schema correctly rejects invalid data and accepts valid data.
 *
 * SHRINKING: If a test fails, fast-check automatically "shrinks" the input
 * to find the absolute minimal string/value that triggers the failure,
 * making debugging catastrophic backtracking or edge cases trivial.
 */
describe("User Signup Schema - Property-Based Tests", () => {
  it('REJECTS any string without an "@" symbol as a valid email', () => {
    fc.assert(
      fc.property(fc.string(), (randomStr: string) => {
        // If the random string doesn't contain '@', it MUST fail email validation
        if (!randomStr.includes("@")) {
          const result = userSignupSchema.safeParse({
            name: "Valid Name",
            email: randomStr,
            password: "ValidPass123!",
            age: 20,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes("email"))).toBe(true);
          }
        }
      }),
      { numRuns: 1000 }, // Execute 1000 random variations
    );
  });

  it("REJECTS names with invalid characters (numbers, symbols)", () => {
    fc.assert(
      fc.property(fc.stringMatching(/[0-9@#$%^&*()_+=[\]{}|;:<>,.?/~`]/), (invalidName: string) => {
        const result = userSignupSchema.safeParse({
          name: invalidName,
          email: "test@example.com",
          password: "ValidPass123!",
          age: 20,
        });
        expect(result.success).toBe(false);
      }),
      { numRuns: 500 },
    );
  });

  it("REJECTS passwords missing at least one required character type", () => {
    fc.assert(
      fc.property(
        // Generate strings that deliberately lack one of the required character classes
        fc.oneof(
          fc.stringMatching(/^[a-z0-9!@#$%^&*]+$/), // Missing uppercase
          fc.stringMatching(/^[A-Z0-9!@#$%^&*]+$/), // Missing lowercase
          fc.stringMatching(/^[a-zA-Z!@#$%^&*]+$/), // Missing number
          fc.stringMatching(/^[a-zA-Z0-9]+$/), // Missing special char
        ),
        (weakPassword: string) => {
          const result = userSignupSchema.safeParse({
            name: "Valid Name",
            email: "test@example.com",
            password: weakPassword,
            age: 20,
          });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("REJECTS ages outside the 13-120 boundary", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ max: 12 }), // Too young
          fc.integer({ min: 121 }), // Too old
          fc.float(), // Not an integer
        ),
        (invalidAge: number) => {
          const result = userSignupSchema.safeParse({
            name: "Valid Name",
            email: "test@example.com",
            password: "ValidPass123!",
            age: invalidAge,
          });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("ACCEPTS all valid, well-formed inputs within boundaries", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z\s\-']{2,50}$/), // Valid name
        fc.email(), // Valid email (fast-check built-in)
        fc.stringMatching(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,128}$/), // Valid password
        fc.integer({ min: 13, max: 120 }), // Valid age
      ),
      (name, email, password, age) => {
        const result = userSignupSchema.safeParse({ name, email, password, age });
        expect(result.success).toBe(true);
      },
      { numRuns: 500 },
    );
  });

  it("DEMONSTRATES SHRINKING: Fails on overly long names and finds minimal culprit", () => {
    // Intentionally testing a scenario where max length is violated
    fc.assert(
      fc.property(fc.string({ minLength: 51, maxLength: 200 }), (longName: string) => {
        const result = userSignupSchema.safeParse({
          name: longName,
          email: "test@example.com",
          password: "ValidPass123!",
          age: 20,
        });
        expect(result.success).toBe(false);
        // Fast-check will shrink this 200-char string down to exactly 51 chars
        // to show the minimal failing case in the error output.
      }),
      { numRuns: 100 },
    );
  });
});
