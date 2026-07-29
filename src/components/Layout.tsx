import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { WebRTCProvider } from "@/components/VideoCall/WebRTCProvider";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "@/components/ScrollToTop";
import { SpeedDial } from "@/components/SpeedDial";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/theme-provider";
import TopProgressBar from "@/components/TopProgressBar";
import ShortcutsModal from "@/components/ShortcutsModal";
import { WebRTCProvider } from "@/components/VideoCall/WebRTCProvider";
import { OfflineBanner } from "@/components/OfflineBanner";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { showAnnouncementToast } from "@/lib/announcements/sse";

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null);

      if (event === "SIGNED_IN" && session) {
        const checkedKey = `device_checked_${session.user.id}`;
        if (!sessionStorage.getItem(checkedKey)) {
          supabase.functions
            .invoke("device-fingerprint-alert", {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
            .then(({ data, error }) => {
              if (!error && data?.isNewDevice) {
                toast.warning(
                  `New Login Detected: Unrecognized device (${data.browser} on ${data.os}). We sent you a security email alert.`,
                );
              }
              if (!error) sessionStorage.setItem(checkedKey, "true");
            })
            .catch(() => {
              // Edge function not deployed or CORS blocked in local dev — ignore silently
            });
        }
      }
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

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.EventSource === "undefined") {
      return;
    }

    const sseUrl =
      import.meta.env.VITE_SSE_URL ||
      import.meta.env.VITE_LIVE_FEED_URL ||
      "http://localhost:8081/events";
    const eventSource = new window.EventSource(sseUrl);

    const handleEvent = (event: MessageEvent<string>) => {
      if (!event.data) return;
      showAnnouncementToast(event.data);
    };

    eventSource.addEventListener("announcement", handleEvent as EventListener);
    eventSource.onmessage = handleEvent;
    eventSource.onerror = () => {
      if (eventSource.readyState === window.EventSource.CLOSED) {
        console.warn("SSE connection closed", sseUrl);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <WebRTCProvider>
          <OfflineBanner />
          <TopProgressBar />

          <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
          <PWAInstallPrompt />

          <Outlet />
          <Toaster />
          <ScrollToTop />
          <SpeedDial />
        </WebRTCProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
