import { supabase } from "../lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { generateUUIDv7 } from "../lib/uuidv7";

/**
 * Authentication Service
 *
 * Provides a centralized, type-safe wrapper around Supabase authentication
 * and user management operations. Integrates with the custom progressive
 * backoff login Edge Function and handles session persistence.
 */

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  college?: string;
}

export interface ResetPasswordData {
  email: string;
}

/**
 * Registers a new user account.
 * Generates a UUIDv7 for the client-side optimistic ID if needed,
 * though Supabase Auth handles the primary `auth.users` ID generation.
 */
export async function signUp(data: SignUpData): Promise<User> {
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.fullName,
        college: data.college || null,
        // Pass a client-generated UUIDv7 to ensure the profile row
        // created by the database trigger has a time-sortable ID immediately
        client_generated_id: generateUUIDv7(),
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!authData.user) {
    throw new Error("User creation failed: No user object returned.");
  }

  return authData.user;
}

/**
 * Signs out the current user and clears all local session data.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Initiates the password reset flow by sending a recovery email.
 */
export async function requestPasswordReset(data: ResetPasswordData): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Updates the user's password using a recovery token.
 * Typically called on the `/auth/reset-password` page after clicking the email link.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Retrieves the currently authenticated user from the local session.
 * Returns null if no user is logged in.
 */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Error fetching current user:", error);
    return null;
  }

  return user;
}

/**
 * Refreshes the current authentication session.
 * Useful for long-running applications to prevent token expiry (401 errors).
 */
export async function refreshSession(): Promise<void> {
  const { error } = await supabase.auth.refreshSession();
  if (error) {
    throw new Error("Failed to refresh session: " + error.message);
  }
}
