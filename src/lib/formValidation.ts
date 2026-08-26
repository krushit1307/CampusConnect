import { z } from "zod";
import type { FieldError } from "react-hook-form";

/**
 * Zod schema for feedback submission forms (#2647).
 */
export const feedbackFormSchema = z.object({
  category: z.enum(["bug", "feature", "general", "other"], {
    errorMap: () => ({ message: "Please select a valid feedback category" }),
  }),
  subject: z
    .string()
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(100, "Subject exceeds maximum 100 characters"),
  message: z
    .string()
    .trim()
    .min(10, "Please provide a more detailed message (at least 10 characters)")
    .max(2000, "Message is too long"),
  email: z.string().trim().email("Please enter a valid email address").optional().or(z.literal("")),
});

export type FeedbackFormData = z.infer<typeof feedbackFormSchema>;

/**
 * Zod schema for user registration / signup forms (#2647).
 */
export const signupFormSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(50),
    lastName: z.string().trim().min(1, "Last name is required").max(50),
    email: z.string().trim().email("Please enter a valid college email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupFormData = z.infer<typeof signupFormSchema>;

/**
 * Accessibility helper for rendering accessible React Hook Form error messages.
 * Returns role="alert", aria-invalid, and aria-describedby properties.
 */
export function getFieldErrorProps(fieldName: string, error?: FieldError) {
  if (!error) {
    return {
      "aria-invalid": false,
    };
  }

  const errorId = `${fieldName}-error`;
  return {
    "aria-invalid": true,
    "aria-describedby": errorId,
    errorId,
    role: "alert" as const,
  };
}
