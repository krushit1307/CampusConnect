import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";

/**
 * Routes that must never trigger the compliance redirect. The compliance
 * page itself, auth helpers, and public/printable surfaces are excluded.
 */
const SKIP_PATHS = new Set([
  "/auth",
  "/mfa-challenge",
  "/compliance-check",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verify",
]);

const IGNORED_PREFIXES = ["/print", "/verify", "/compliance-check"];

const checkCache = new Map<string, { userId: string; value: boolean }>();
const CACHE_TTL_MS = 60_000;

async function hasPendingConstitutionRatification(accessToken: string): Promise<boolean> {
  try {
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/constitution-ratification-status`;
    const response = await fetch(fnUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { needs_ratification?: boolean };
    return body.needs_ratification === true;
  } catch {
    // Do not lock users out when the status endpoint is temporarily unavailable.
    return false;
  }
}

/**
 * Global router guard for #3188. When a signed-in club executive holds an
 * active role with an outstanding (unsigned) bylaws signature, they are
 * redirected to the mandatory `/compliance-check` route before they can
 * access anything else.
 */
export function ComplianceCheckGuard() {
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
      if (await hasPendingConstitutionRatification(session.access_token)) {
        const redirectTo = `${pathname}${location.search}`;
        navigate(
          `/compliance-check?mode=ratification&redirectTo=${encodeURIComponent(redirectTo)}`,
          { replace: true },
        );
        return;
      }

      const cached = checkCache.get(userId);
      if (!cached || cached.userId !== userId) {
        // Check outstanding signatures via the edge function.
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/bylaws-compliance-status`;
        try {
          const res = await fetch(fnUrl, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (!res.ok) return;
          const body = (await res.json()) as { needs_compliance?: boolean };
          const value = body.needs_compliance === true;
          checkCache.set(userId, { userId, value });
          setTimeout(() => checkCache.delete(userId), CACHE_TTL_MS);
          if (cancelled) return;
          if (!value) return;
        } catch {
          // On network errors, do not lock the user out.
          if (cancelled) return;
          return;
        }
      } else {
        if (cancelled) return;
        if (!cached.value) return;
      }

      const redirectTo = `${pathname}${location.search}`;
      navigate(`/compliance-check?redirectTo=${encodeURIComponent(redirectTo)}`, {
        replace: true,
      });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, navigate, supabase]);

  return <Outlet />;
}
