import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const LAST_ACTIVE_KEY = "lastActiveTime";
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const THROTTLE_MS = 5000; // Throttle activity updates to once every 5 seconds
const CHECK_INTERVAL_MS = 60 * 1000; // Check inactivity every 1 minute

interface UseIdleTimeoutOptions {
  timeoutMs?: number;
  onTimeout?: () => void;
}

export function useIdleTimeout(options?: UseIdleTimeoutOptions) {
  const navigate = useNavigate();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // Helper to update last active timestamp with throttling
    const updateActivity = () => {
      const now = Date.now();
      if (now - lastUpdateRef.current >= THROTTLE_MS) {
        lastUpdateRef.current = now;
        localStorage.setItem(LAST_ACTIVE_KEY, now.toString());
      }
    };

    // Initialize timestamp on hook mount if not present
    if (!localStorage.getItem(LAST_ACTIVE_KEY)) {
      localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
    }

    // Attach user activity listeners to window
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "wheel", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Check timeout periodically
    const intervalId = setInterval(() => {
      const lastActiveStr = localStorage.getItem(LAST_ACTIVE_KEY);
      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();
      const now = Date.now();

      if (now - lastActive >= timeoutMs) {
        // Inactivity threshold reached
        if (options?.onTimeout) {
          options.onTimeout();
        } else {
          // Default cleanup: clear local storage and redirect
          localStorage.clear();
          sessionStorage.clear();
          navigate("/login?reason=timeout", { replace: true });
        }
      }
    }, CHECK_INTERVAL_MS);

    // Sync activity across multiple tabs via storage events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVE_KEY && e.newValue) {
        lastUpdateRef.current = parseInt(e.newValue, 10);
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(intervalId);
    };
  }, [navigate, timeoutMs, options]);
}
