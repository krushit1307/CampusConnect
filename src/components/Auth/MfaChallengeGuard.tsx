import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { requiresMfaChallenge } from "@/lib/mfa";

/**
 * Routes that must never trigger the MFA challenge redirect. Authentication
 * helpers (login, MFA challenge, password recovery, OAuth callbacks) handle
 * their own session logic.
 */
const SKIP_PATHS = new Set([
  "/auth",
  "/mfa-challenge",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

const IGNORED_PREFIXES = ["/mfa-challenge", "/print", "/verify"];

const checkCache = new Map<string, { userId: string; value: boolean }>();
const CACHE_TTL_MS = 60_000;

/**
 * Global router guard for #2739. When a signed-in club executive / system admin
 * still sits at aal1 (password only) but has a verified TOTP factor enrolled,
 * they are redirected to the strict `/mfa-challenge` route before they can
 * access anything else.
 */
export function MfaChallengeGuard() {
  const supabase = createClient();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;

    if (
      SKIP_PATHS.has(pathname) ||
      IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    ) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const userId = session.user.id;
      const cached = checkCache.get(userId);
      if (!cached || cached.userId !== userId) {
        const value = await requiresMfaChallenge(supabase);
        checkCache.set(userId, { userId, value });
        setTimeout(() => checkCache.delete(userId), CACHE_TTL_MS);
        if (cancelled) return;
        if (!value) return;
      } else {
        if (cancelled) return;
        if (!cached.value) return;
      }

      const redirectTo = `${pathname}${location.search}`;
      navigate(`/mfa-challenge?redirectTo=${encodeURIComponent(redirectTo)}`, { replace: true });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, navigate, supabase]);

  return <Outlet />;
}
