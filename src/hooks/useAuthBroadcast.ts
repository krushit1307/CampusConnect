// src/hooks/useAuthBroadcast.ts
//
// Cross-tab Auth State Synchronization (Issue #2692).
//
// Wires the BroadcastChannel-based sync into the Supabase
// onAuthStateChange flow. When the user signs out in Tab A, every
// other open tab receives the broadcast and immediately clears its
// local auth state + redirects to /login.
//
// Usage (mount once at the app root, e.g., in App.tsx):
//   useAuthBroadcast();
//
// The hook reads auth state from the existing useAuthStore (Zustand)
// and listens to Supabase's onAuthStateChange for the canonical
// sign-out event.

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";

const AUTH_CHANNEL = "campusconnect:auth";

interface AuthBroadcastMessage {
  type: "SIGN_OUT" | "SIGN_IN" | "TOKEN_REFRESHED";
  origin: string;
  timestamp: number;
  userId?: string;
}

const INSTANCE_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * Cross-tab auth synchronization.
 *
 * Listens to Supabase's onAuthStateChange. When a SIGN_OUT event
 * fires in this tab, broadcasts a "SIGN_OUT" message to all other
 * tabs via BroadcastChannel. When a "SIGN_OUT" message arrives
 * from another tab, clears the local auth store and navigates to
 * /login.
 *
 * Mount this hook ONCE at the app root (inside the Router context
 * so useNavigate works).
 */
export function useAuthBroadcast(): void {
  const navigate = useNavigate();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    // ── Open the auth broadcast channel ────────────────────
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channelRef.current = channel;

    // ── Listen for auth broadcasts from other tabs ──────────
    const handleMessage = (event: MessageEvent<AuthBroadcastMessage>) => {
      const msg = event.data;
      if (!msg || msg.origin === INSTANCE_ID) {
        // Ignore our own broadcasts — prevents loops.
        return;
      }

      if (msg.type === "SIGN_OUT") {
        // Clear local auth state WITHOUT re-broadcasting
        // (the reset() action just clears the store).
        reset();
        // Redirect to login. Replace so the user can't
        // "back" into the authenticated page after sign-out.
        navigate("/auth/login", { replace: true });
      }
      // We intentionally do NOT auto-login on "SIGN_IN"
      // broadcasts — that would be a security risk (a login
      // in one tab shouldn't auto-login other tabs without
      // the user's action). Each tab fetches its own session
      // on mount via supabase.auth.getSession().
    };
    channel.addEventListener("message", handleMessage);

    // ── Listen to Supabase onAuthStateChange ───────────────
    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === "SIGNED_OUT") {
        // Broadcast the sign-out to other tabs.
        try {
          channel.postMessage({
            type: "SIGN_OUT",
            origin: INSTANCE_ID,
            timestamp: Date.now(),
          } satisfies AuthBroadcastMessage);
        } catch (err) {
          console.warn("[useAuthBroadcast] Failed to broadcast SIGN_OUT:", err);
        }

        // Also clear local state + navigate (in case
        // the sign-out originated in this tab).
        reset();
        navigate("/auth/login", { replace: true });
      }
      // TOKEN_REFRESHED events are handled per-tab by
      // Supabase itself — no need to broadcast.
    });

    // ── Listen to the storage event as a fallback ──────────
    // BroadcastChannel doesn't fire in the originating tab,
    // but the storage event DOES fire in other tabs when
    // Supabase writes to localStorage on sign-out. This is a
    // belt-and-suspenders fallback for browsers that don't
    // support BroadcastChannel.
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("sb-") && e.newValue === null) {
        // A Supabase auth key was removed in another tab.
        reset();
        navigate("/auth/login", { replace: true });
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      channelRef.current = null;
      authSubscription.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, [navigate, reset]);
}
