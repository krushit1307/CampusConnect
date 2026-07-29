/**
 * Resolves the Supabase project URL using a multi-source fallback chain.
 * Checks `import.meta.env.VITE_SUPABASE_URL`, then `import.meta.env.NEXT_PUBLIC_SUPABASE_URL`,
 * then `process.env.VITE_SUPABASE_URL`, then `process.env.NEXT_PUBLIC_SUPABASE_URL`.
 * @returns {string} The resolved Supabase project URL.
 * @throws {Error} If no Supabase URL is defined in any of the checked sources.
 */
export declare function getSupabaseUrl(): string;
/**
 * Creates and configures a browser-side Supabase client instance.
 * This client is used in client-side components to perform database operations,
 * listen to real-time updates, and handle user authentication sessions.
 * @function createClient
 * @returns {import("@supabase/supabase-js").SupabaseClient} An initialized browser-safe Supabase client instance.
 * @throws {Error} Throws an error if environment variables are missing or if the Supabase URL format is invalid.
 */
export declare function createClient(): import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
/**
 * Sends a request to join an invite-only club.
 * @param clubId The ID of the club.
 * @param userId The ID of the user requesting to join.
 * @param message Optional message to the club admins.
 */
export declare function requestClubJoin(clubId: string, userId: string, message?: string | null): Promise<any>;
