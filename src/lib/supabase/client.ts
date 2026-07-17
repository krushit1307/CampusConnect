/**
 * 🌟 GOOD FIRST ISSUE FRIENDLY 🌟
 *
 * Welcome new contributors! This file sets up our connection to the Supabase backend.
 * Supabase is like our database and authentication server all in one.
 *
 * What this code does in plain English:
 * 1. It grabs our project URL and public "anon" key from the environment variables (like a password safe).
 * 2. It creates a "browser client" which is basically a secure tunnel our React app uses
 * to talk to Supabase (e.g., to fetch events or check if a user is logged in).
 *
 * You usually don't need to change this file unless we are adding new backend services!
 */
import { createBrowserClient } from "@supabase/ssr";

// Polyfill WebSocket for SSR on older Node.js versions (e.g. Node 20)
if (typeof window === "undefined" && !globalThis.WebSocket) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = class {};
}

// Validate environment variables on app startup in development mode
if (import.meta.env.DEV) {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL : undefined) ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined);

  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (typeof process !== "undefined" ? process.env.VITE_SUPABASE_ANON_KEY : undefined) ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);

  if (!url || !anonKey) {
    const missing = [];
    if (!url) missing.push("VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
    if (!anonKey) missing.push("VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");
    const errorMsg = `[CampusConnect] Missing required environment variable(s): ${missing.join(", ")}. Please check your .env.local file.`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  let isValid = false;
  try {
    const parsedUrl = new URL(url);
    isValid = parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch (err) {
    // URL parsing failed
  }

  if (!isValid) {
    const errorMsg = `[CampusConnect] Invalid Supabase URL: "${url}". Please check your VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) in .env.local and make sure it is a valid HTTP or HTTPS URL.`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

/**
 * Resolves the Supabase project URL using a multi-source fallback chain.
 * Checks `import.meta.env.VITE_SUPABASE_URL`, then `import.meta.env.NEXT_PUBLIC_SUPABASE_URL`,
 * then `process.env.VITE_SUPABASE_URL`, then `process.env.NEXT_PUBLIC_SUPABASE_URL`.
 * @returns {string} The resolved Supabase project URL.
 * @throws {Error} If no Supabase URL is defined in any of the checked sources.
 */
export function getSupabaseUrl(): string {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL : undefined) ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined);

  if (!url) {
    throw new Error(
      "Supabase URL must be defined in your environment variables (VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL).",
    );
  }

  return url;
}

/**
 * Creates and configures a browser-side Supabase client instance.
 * This client is used in client-side components to perform database operations,
 * listen to real-time updates, and handle user authentication sessions.
 * @function createClient
 * @returns {import("@supabase/supabase-js").SupabaseClient} An initialized browser-safe Supabase client instance.
 * @throws {Error} Throws an error if environment variables are missing or if the Supabase URL format is invalid.
 */
export function createClient() {
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL : undefined) ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined);
  const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (typeof process !== "undefined" ? process.env.VITE_SUPABASE_ANON_KEY : undefined) ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be defined in your environment variables.");
  }

  // Validate URL to prevent `@supabase/ssr` from crashing with a cryptic error
  try {
    new URL(supabaseUrl);
  } catch (err) {
    throw new Error(`Invalid Supabase URL: "${supabaseUrl}". Please check your .env.local file.`);
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Sends a request to join an invite-only club.
 * @param clubId The ID of the club.
 * @param userId The ID of the user requesting to join.
 * @param message Optional message to the club admins.
 */
export async function requestClubJoin(clubId: string, userId: string, message?: string | null) {
  const normalizedMessage = message ?? "";
  const supabase = createClient();

  // 1. Check if a request already exists
  const { data: existingRequest, error: fetchError } = await supabase
    .from("club_requests")
    .select("id, status")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to check existing requests: ${fetchError.message}`);
  }

  if (existingRequest) {
    if (existingRequest.status === "pending") {
      throw new Error("You already have a pending join request for this club.");
    }
    if (existingRequest.status === "approved") {
      throw new Error("You are already a member of this club.");
    }
  }

  // 2. Insert new request
  const { data, error } = await supabase
    .from("club_requests")
    .insert({
      club_id: clubId,
      user_id: userId,
      message: normalizedMessage.trim(),
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to submit join request: ${error.message}`);
  }

  return data;
}
