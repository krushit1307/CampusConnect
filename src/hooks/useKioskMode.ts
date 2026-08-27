// =============================================================================
// Hook: useKioskMode
// Issue: #2732 - Implement 'Scan to Check-in' Kiosk Mode for Tablets
// Description: Manages the state of the kiosk session, including fullscreen
// mode, the hidden exit gesture counter, and the check-in feedback state.
// =============================================================================

import { useState, useCallback, useRef, useEffect } from "react";
import {
  downloadRsvpsForOfflineUse,
  findLocalRsvp,
  markLocalRsvpAttended,
  flushKioskSyncQueue,
} from "../lib/kioskOfflineSync";

export type KioskStatus = "idle" | "scanning" | "success" | "error" | "already_checked_in";

interface CheckInResult {
  status: KioskStatus;
  userName?: string;
  errorMessage?: string;
  isOfflineCheckIn?: boolean;
}

interface UseKioskModeReturn {
  isFullscreen: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => void;
  status: KioskStatus;
  result: CheckInResult | null;
  processScan: (qrData: string) => Promise<void>;
  exitGestureCount: number;
  incrementExitGesture: () => void;
  resetStatus: () => void;
  isOffline: boolean;
  pendingSyncCount: number;
}
export function useKioskMode(eventId: string): UseKioskModeReturn {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [status, setStatus] = useState<KioskStatus>("idle");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [exitGestureCount, setExitGestureCount] = useState(0);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<boolean>(false);
  // Enter Fullscreen Mode
  const enterFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        /* Safari */
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        /* IE11 */
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.error("[KioskMode] Failed to enter fullscreen:", err);
    }
  }, []);

  // Exit Fullscreen Mode
  const exitFullscreen = useCallback(() => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  }, []);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Pre-fetch the full RSVP list into IndexedDB before scanning starts
  useEffect(() => {
    if (!eventId) return;
    downloadRsvpsForOfflineUse(eventId).catch((err) =>
      console.error("[KioskMode] Failed to pre-cache RSVPs:", err),
    );
  }, [eventId]);

  // Monitor connectivity and flush the local sync_queue whenever we come
  // back online (also triggered by the Service Worker's background sync
  // "OFFLINE_RSVP_SYNC" message so a reconnect is caught even in the background).
  useEffect(() => {
    const syncQueue = async () => {
      const { syncedCount } = await flushKioskSyncQueue();
      if (syncedCount > 0) {
        setPendingSyncCount((count) => Math.max(0, count - syncedCount));
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
      syncQueue();
    };
    const handleOffline = () => setIsOffline(true);
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_RSVP_SYNC") {
        syncQueue();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    navigator.serviceWorker?.addEventListener?.("message", handleSwMessage);
    syncQueue();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener?.("message", handleSwMessage);
    };
  }, []);

  // Process QR Code Scan
  const processScan = useCallback(
    async (qrData: string) => {
      // Aggressive debouncing to prevent scanning the same code 50 times in a second
      if (debounceRef.current) return;
      debounceRef.current = true;
      setTimeout(() => {
        debounceRef.current = false;
      }, 2000);

      setStatus("scanning");

      try {
        // Expected QR format: JSON string { "rsvpId": "uuid", "userId": "uuid" }
        // OR simple UUID string of the RSVP ID
        let rsvpId = qrData;
        try {
          const parsed = JSON.parse(qrData);
          if (parsed.rsvpId) rsvpId = parsed.rsvpId;
        } catch {
          // Assume it's a raw UUID string
        }

        // 1. Look up the RSVP in the local IndexedDB cache — never Supabase
        const rsvp = await findLocalRsvp(eventId, rsvpId);

        if (!rsvp) {
          throw new Error("Invalid ticket or wrong event.");
        }

        // 2. Check if already checked in
        if (rsvp.checked_in) {
          setResult({
            status: "already_checked_in",
            userName: rsvp.full_name,
          });
          setStatus("already_checked_in");
          scheduleReset();
          return;
        }

        // 3. Update local IndexedDB status and push the scan to the sync_queue
        await markLocalRsvpAttended(rsvp);
        setPendingSyncCount((count) => count + 1);

        // 4. Success! (offline-first — synced to Supabase once reconnected)
        setResult({
          status: "success",
          userName: rsvp.full_name,
          isOfflineCheckIn: typeof navigator !== "undefined" ? !navigator.onLine : false,
        });
        setStatus("success");
        scheduleReset();      } catch (err: any) {
        setResult({
          status: "error",
          errorMessage: err.message || "Check-in failed",
        });
        setStatus("error");
        scheduleReset();
      }
    },
    [eventId],
  );

  // Automatically reset to scanning mode after 3 seconds
  const scheduleReset = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetStatus();
    }, 3000);
  };

  const resetStatus = () => {
    setStatus("scanning");
    setResult(null);
  };

  // Hidden Exit Gesture (Tap top-left 5 times)
  const incrementExitGesture = useCallback(() => {
    setExitGestureCount((prev) => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        // Trigger exit
        window.location.href = "/dashboard"; // Or wherever the admin dashboard is
        return 0;
      }
      // Reset counter if they take too long between taps
      setTimeout(() => setExitGestureCount(0), 3000);
      return newCount;
    });
  }, []);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    status,
    result,
    processScan,
    exitGestureCount,
    incrementExitGesture,
    resetStatus,
    isOffline,
    pendingSyncCount,
  };
}