import { useState, useEffect } from "react";

/**
 * useOnlineStatus
 *
 * Tracks the browser's connectivity state (`navigator.onLine`).
 * Subscribes to window `online` and `offline` events to update state instantly.
 *
 * @returns boolean `isOnline` (true if connected, false if offline)
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Sync state in case navigator.onLine changed before listener attached
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
