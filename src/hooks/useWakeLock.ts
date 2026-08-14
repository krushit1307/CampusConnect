// =============================================================================
// Hook: useWakeLock
// Issue: #2732 - Implement 'Scan to Check-in' Kiosk Mode for Tablets
// Description: Uses the Screen Wake Lock API to prevent the device screen
// from turning off automatically while the kiosk is active.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react";

interface UseWakeLockReturn {
  isSupported: boolean;
  isActive: boolean;
  requestWakeLock: () => Promise<void>;
  releaseWakeLock: () => Promise<void>;
}

export function useWakeLock(): UseWakeLockReturn {
  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    // Check if the Wake Lock API is supported in the browser
    setIsSupported("wakeLock" in navigator);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!isSupported) {
      console.warn("[WakeLock] Screen Wake Lock API is not supported in this browser.");
      return;
    }

    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      setIsActive(true);
      console.log("[WakeLock] Screen Wake Lock activated.");

      // Listen for release events (e.g., tab becomes hidden)
      wakeLockRef.current.addEventListener("release", () => {
        console.log("[WakeLock] Screen Wake Lock released.");
        setIsActive(false);
      });
    } catch (err: any) {
      console.error("[WakeLock] Failed to activate Wake Lock:", err);
      // Common reasons: low battery, permission denied, or page not visible
    }
  }, [isSupported]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
      } catch (err) {
        console.error("[WakeLock] Failed to release Wake Lock:", err);
      }
    }
  }, []);

  // Re-acquire wake lock when the page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current && isActive) {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, []);

  return {
    isSupported,
    isActive,
    requestWakeLock,
    releaseWakeLock,
  };
}
