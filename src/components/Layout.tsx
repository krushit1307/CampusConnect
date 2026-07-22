import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "@/components/ScrollToTop";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/theme-provider";
import TopProgressBar from "@/components/TopProgressBar";
import ShortcutsModal from "@/components/ShortcutsModal";

// Persistent banner shown while the browser has no network connection.
function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Maintain lightweight auth state
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

  // Track DAU
  useEffect(() => {
    if (!userId) return;

    const todayUTC = new Date().toISOString().split("T")[0];
    const storageKey = `session_recorded_${userId}`;

    if (localStorage.getItem(storageKey) !== todayUTC) {
      const supabase = createClient();

      supabase.rpc("record_daily_session").then(({ error }) => {
        if (!error) {
          localStorage.setItem(storageKey, todayUTC);
        }
      });
    }
  }, [location.pathname, userId]);

  // Keyboard shortcut (Shift + /)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <OfflineBanner />
        <TopProgressBar />

        <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

        <Outlet />
        <Toaster />
        <ScrollToTop />
      </TooltipProvider>
    </ThemeProvider>
  );
}
