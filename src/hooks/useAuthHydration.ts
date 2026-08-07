import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { registerDeviceSession } from "@/lib/deviceSession";
import type { User } from "@supabase/supabase-js";

const supabase = createClient();

const REGISTRATION_KEY = "cc_device_session_registered";

// Register once per tab boot so we don't fire an edge call on every
// navigation, while still guaranteeing the current device has a row.
function shouldRegisterOnBoot(): boolean {
  try {
    return sessionStorage.getItem(REGISTRATION_KEY) !== "1";
  } catch {
    return true;
  }
}

function markRegistered(): void {
  try {
    sessionStorage.setItem(REGISTRATION_KEY, "1");
  } catch {
    // storage unavailable (SSR/private mode) — registration still fires on SIGNED_IN
  }
}

function hasOAuthCallbackParams(): boolean {
  if (typeof window === "undefined") return false;
  const search = window.location.search || "";
  const hash = window.location.hash || "";
  return (
    search.includes("code=") ||
    search.includes("error=") ||
    hash.includes("access_token=") ||
    hash.includes("refresh_token=") ||
    hash.includes("error=")
  );
}

/**
 * Custom hook to handle auth hydration state.
 * Prevents the "flash of unauthenticated state" (FOUA) by tracking
 * an `isInitializing` boolean that only resolves after the first
 * auth state check completes or after OAuth redirect token exchange.
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

    const isOAuthFlow = hasOAuthCallbackParams();

    // Get initial session (checks local storage / cookies)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setIsInitializing(false);
        clearTimeout(timeoutId);
      } else if (!isOAuthFlow) {
        // If not an OAuth callback flow, resolve initialization immediately
        setUser(null);
        setIsInitializing(false);
        clearTimeout(timeoutId);
      }
      // If isOAuthFlow is true and session is null, wait for onAuthStateChange
      // to finish exchanging the auth code/token.
    });

    // Listen for subsequent auth changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setIsInitializing(false); // Ensure it's false on any auth state change
      clearTimeout(timeoutId);

      // Track every sign-in as an individual device session so it can be
      // remotely revoked from the Security Hub. SIGNED_IN covers
      // email/password, OAuth, and passkey flows; INITIAL_SESSION covers
      // reloads (once per tab boot) where a fresh token arrived.
      if (!session?.access_token) return;

      if (event === "SIGNED_IN") {
        markRegistered();
        void registerDeviceSession({ accessToken: session.access_token });
      } else if (event === "INITIAL_SESSION" && shouldRegisterOnBoot()) {
        markRegistered();
        void registerDeviceSession({ accessToken: session.access_token });
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  return { user, isInitializing };
}
