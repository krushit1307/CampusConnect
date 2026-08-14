import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { WebRTCProvider } from "@/components/VideoCall/WebRTCProvider";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "@/components/ScrollToTop";
import { RadialFAB } from "@/components/RadialFAB";
import { FloatingChat } from "@/components/FloatingChat";
import { createClient } from "@/lib/supabase/client";
import TopProgressBar from "@/components/TopProgressBar";
import ShortcutsModal from "@/components/ShortcutsModal";
import { useAnnouncementStream } from "@/hooks/useAnnouncementStream";
import { SessionExpiryModal } from "@/components/SessionExpiryModal";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { CommandPalette } from "@/components/ui/command-palette";
import { showAnnouncementToast } from "@/lib/announcements/sse";
import { SkipToContent } from "@/components/SkipToContent";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { GlobalAudioPlayer } from "@/components/audio/GlobalAudioPlayer";

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
  const { i18n } = useTranslation();

  // Keep <html lang="..."> in sync with the active language
  // Required for accessibility (screen readers), SEO, and browser behaviour
  useEffect(() => {
    const lang = i18n.language?.split("-")[0] ?? "en";
    document.documentElement.lang = lang;
  }, [i18n.language]);

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

  // Enable SSE announcement stream for authenticated users only
  useAnnouncementStream(userId);

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
    <>
      <TooltipProvider delayDuration={200}>
        <WebRTCProvider>
          <SkipToContent />
          <OfflineBanner />
          <TopProgressBar />
          <SessionExpiryModal />
 feature/3014-referral-leaderboard
          <ImpersonationBanner />
          <GlobalAudioPlayer />

 main

          <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
          <PWAInstallPrompt />

          <main id="main-content" className="flex-1 w-full h-full min-h-screen">
            <Outlet />
          </main>

 feature/3014-referral-leaderboard
          <Toaster richColors />

          <Toaster />
 main
          <ScrollToTop />
          <RadialFAB />
          {userId && <FloatingChat />}
          <CommandPalette />
        </WebRTCProvider>
      </TooltipProvider>
 feature/3014-referral-leaderboard

      <ImpersonationBanner />
 main
    </>
  );
}
