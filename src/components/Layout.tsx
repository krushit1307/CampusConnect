import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "@/components/ScrollToTop";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/theme-provider";
import TopProgressBar from "@/components/TopProgressBar";

// Persistent banner shown while the browser has no network connection.
// Sits above everything else so it's visible regardless of which page
// the user is on, and disappears automatically once connectivity is
// restored (no dismiss button needed / no interaction required).
function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // Re-sync in case connectivity changed between the initial render
    // (when navigator.onLine was first read) and this effect attaching
    // the listeners above — otherwise a transition in that gap would be
    // missed until some later online/offline event happens to correct it.
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] border-b-2 border-black bg-peach px-4 py-2 text-center font-mono text-xs font-bold uppercase tracking-wider text-black md:text-sm"
    >
      You are currently offline. Some features may be unavailable.
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const [userId, setUserId] = useState<string | null>(null);

  // 1. Maintain lightweight auth state without polling
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Track DAU on active navigation and initial load
  useEffect(() => {
    if (!userId) return;

    // Use UTC date to ensure consistency with PostgreSQL DATE()
    const todayUTC = new Date().toISOString().split("T")[0];
    const storageKey = `session_recorded_${userId}`;

    // Throttle inserts to once per day per local device
    if (localStorage.getItem(storageKey) !== todayUTC) {
      const supabase = createClient();

      // Fire and forget RPC
      supabase.rpc("record_daily_session").then(({ error }) => {
        if (!error) {
          localStorage.setItem(storageKey, todayUTC);
        }
      });
    }
  }, [location.pathname, userId]); // Triggers on SPA navigation or login

  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <OfflineBanner />
        <TopProgressBar />
        <Outlet />
        <Toaster />
        <ScrollToTop />
      </TooltipProvider>
    </ThemeProvider>
  );
}
