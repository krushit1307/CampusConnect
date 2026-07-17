import { createServerClient } from "@supabase/ssr";
// @ts-expect-error - internal dependency of TanStack Start
import { getCookie, setCookie } from "vinxi/http";

/**
 * Creates and configures a server-side Supabase client instance using Vinxi HTTP helpers.
 * This client is used in server-side execution contexts (such as Server Actions, API routes, or
 * server-rendered components) to securely interact with the database while automatically
 * managing user authentication state via session cookies.
 * @function createServer
 * @returns {import("@supabase/supabase-js").SupabaseClient} An initialized server-safe Supabase client configured with cookie storage methods. (Note: cookie writes may be ignored in Server Components, so session persistence may require middleware).
 * @throws {Error} Throws an error if environment variables are missing.
 */
export function createServer() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be defined");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return getCookie(name);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set(name: string, value: string, options: any) {
        try {
          setCookie(name, value, options);
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      remove(name: string, options: any) {
        try {
          setCookie(name, "", { ...options, maxAge: 0 });
        } catch (error) {
          // The `remove` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
