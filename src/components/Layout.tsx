import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "@/components/ScrollToTop";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/theme-provider";
import TopProgressBar from "@/components/TopProgressBar";

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
        <TopProgressBar />
        <Outlet />
        <Toaster />
        <ScrollToTop />
      </TooltipProvider>
    </ThemeProvider>
  );
}
