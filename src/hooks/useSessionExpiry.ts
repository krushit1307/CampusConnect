import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

function decodeJwtSafe(token: string) {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

export function useSessionExpiry() {
  const [showModal, setShowModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = createClient();

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
  }, []);

  const handleLogout = useCallback(async () => {
    clearTimers();
    setShowModal(false);
    await supabase.auth.signOut();
    // Redirect to login page
    window.location.href = "/auth";
  }, [supabase, clearTimers]);

  const scheduleTimers = useCallback(
    (expSeconds: number) => {
      clearTimers();
      const expMs = expSeconds * 1000;
      const now = Date.now();
      const warningDelay = expMs - now - 120000; // 2 minutes before expiry
      const expiryDelay = expMs - now;

      // If already expired, or expiring in less than 2 minutes
      if (warningDelay <= 0 && expiryDelay > 0) {
        setShowModal(true);
      } else if (expiryDelay <= 0) {
        handleLogout();
        return;
      } else {
        warningTimerRef.current = setTimeout(() => {
          setShowModal(true);
        }, warningDelay);
      }

      if (expiryDelay > 0) {
        expiryTimerRef.current = setTimeout(() => {
          handleLogout();
        }, expiryDelay);
      }
    },
    [clearTimers, handleLogout],
  );

  const setupFromToken = useCallback(
    (token: string) => {
      const decoded = decodeJwtSafe(token);
      if (decoded && decoded.exp) {
        scheduleTimers(decoded.exp);
      }
    },
    [scheduleTimers],
  );

  // Initialize from current session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setupFromToken(session.access_token);
      }
    });

    // Listen for auth state changes locally
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        setupFromToken(session.access_token);
        setShowModal(false);
      } else {
        clearTimers();
        setShowModal(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimers();
    };
  }, [supabase, setupFromToken, clearTimers]);

  // Multi-tab synchronization using BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel("session_sync");

    channel.onmessage = (event) => {
      if (event.data === "refresh") {
        // Fetch new session from local storage implicitly by calling getSession
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.access_token) {
            setupFromToken(session.access_token);
            setShowModal(false);
          }
        });
      } else if (event.data === "logout") {
        clearTimers();
        setShowModal(false);
        window.location.href = "/auth";
      }
    };

    return () => {
      channel.close();
    };
  }, [supabase, setupFromToken, clearTimers]);

  const refreshSession = useCallback(async () => {
    setIsRefreshing(true);
    const { data, error } = await supabase.auth.refreshSession();
    setIsRefreshing(false);

    if (error || !data.session) {
      // If refresh fails, logout immediately
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("session_sync");
        channel.postMessage("logout");
        channel.close();
      }
      await handleLogout();
    } else {
      // Success
      setShowModal(false);
      setupFromToken(data.session.access_token);
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("session_sync");
        channel.postMessage("refresh");
        channel.close();
      }
    }
  }, [supabase, handleLogout, setupFromToken]);

  return {
    showModal,
    isRefreshing,
    refreshSession,
    handleLogout,
  };
}
