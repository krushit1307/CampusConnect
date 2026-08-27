import { createClient } from "./supabase/client";

export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Sanitizes typed or pasted string to extract up to 6 digits.
 */
export function cleanOtpInput(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input.replace(/\D/g, "").slice(0, 6);
}

/**
 * Validates whether an OTP code is a valid 6-digit numeric string.
 */
export function validateOtpCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Sends a 6-digit OTP code / magic link to the user's email address via Supabase Auth.
 */
export async function sendOtpEmail(email: string): Promise<{ success: boolean; error?: string }> {
  if (!email || !email.trim() || !email.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Verifies a 6-digit OTP code for a given email address via Supabase Auth.
 */
export async function verifyOtpCode(
  email: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const cleanedToken = cleanOtpInput(token);
  if (!validateOtpCode(cleanedToken)) {
    return { success: false, error: "OTP code must be a 6-digit numeric code." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: cleanedToken,
    type: "email",
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
