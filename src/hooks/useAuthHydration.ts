import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const supabase = createClient();

/**
 * Custom hook to handle auth hydration state.
 * Prevents the "flash of unauthenticated state" (FOUA) by tracking
 * an `isInitializing` boolean that only resolves after the first
 * auth state check completes.
 */
export function useAuthHydration() {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Timeout fallback: If auth check hangs (network error), force resolve after 5s
    // so the user isn't stuck on a skeleton screen forever.
    const timeoutId = setTimeout(() => {
      setIsInitializing(false);
    }, 5000);

    // Get initial session (checks local storage / cookies)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsInitializing(false);
      clearTimeout(timeoutId);
    });

    // Listen for subsequent auth changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsInitializing(false); // Ensure it's false on any auth state change
      clearTimeout(timeoutId);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  return { user, isInitializing };
}
