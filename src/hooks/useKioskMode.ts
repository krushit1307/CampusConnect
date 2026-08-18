// =============================================================================
// Hook: useKioskMode
// Issue: #2732 - Implement 'Scan to Check-in' Kiosk Mode for Tablets
// Description: Manages the state of the kiosk session, including fullscreen
// mode, the hidden exit gesture counter, and the check-in feedback state.
// =============================================================================

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export type KioskStatus = "idle" | "scanning" | "success" | "error" | "already_checked_in";

interface CheckInResult {
  status: KioskStatus;
  userName?: string;
  errorMessage?: string;
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
}

export function useKioskMode(eventId: string): UseKioskModeReturn {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [status, setStatus] = useState<KioskStatus>("idle");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [exitGestureCount, setExitGestureCount] = useState(0);

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

        // 1. Verify the RSVP exists and belongs to this event
        const { data: rsvp, error: rsvpError } = await supabase
          .from("event_rsvps")
          .select("*, profiles:user_id(full_name)")
          .eq("id", rsvpId)
          .eq("event_id", eventId)
          .single();

        if (rsvpError || !rsvp) {
          throw new Error("Invalid ticket or wrong event.");
        }

        // 2. Check if already checked in
        if (rsvp.checked_in) {
          setResult({
            status: "already_checked_in",
            userName: (rsvp.profiles as any)?.full_name || "Attendee",
          });
          setStatus("already_checked_in");
          scheduleReset();
          return;
        }

        // 3. Perform the check-in mutation
        const { error: updateError } = await supabase
          .from("event_rsvps")
          .update({ checked_in: true })
          .eq("id", rsvpId);

        if (updateError) throw updateError;

        // 4. Success!
        setResult({
          status: "success",
          userName: (rsvp.profiles as any)?.full_name || "Attendee",
        });
        setStatus("success");
        scheduleReset();
      } catch (err: any) {
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
  };
}
