import { z } from "zod";

/**
 * User Signup Validation Schema
 * Enforces strict boundaries to prevent hostile inputs, injection, and resource exhaustion.
 */
export const userSignupSchema = z.object({
  // Name: 2-50 chars, only letters, spaces, hyphens, and apostrophes
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters")
    .regex(/^[a-zA-Z\s\-']+$/, "Name contains invalid characters"),

  // Email: Standard email format, max 255 chars to prevent ReDoS on some regex engines
  email: z
    .string()
    .min(5, "Email is too short")
    .max(255, "Email cannot exceed 255 characters")
    .email("Invalid email format")
    .toLowerCase(),

  // Password: Min 8 chars, requires uppercase, lowercase, number, and special char
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),

  // Age: Must be a number between 13 and 120
  age: z
    .number()
    .int("Age must be a whole number")
    .min(13, "You must be at least 13 years old")
    .max(120, "Invalid age provided"),
});

export type UserSignupInput = z.infer<typeof userSignupSchema>;
