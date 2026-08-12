// src/hooks/useThemeBroadcast.ts
//
// Cross-tab Theme Synchronization (Issue #2692).
//
// Wraps the existing useTheme hook's setTheme so that theme changes
// in one tab instantly propagate to all other tabs.
//
// Mount once at the app root.

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme-provider";

const THEME_CHANNEL = "campusconnect:theme";

interface ThemeBroadcastMessage {
  theme: string;
  origin: string;
  timestamp: number;
}

const INSTANCE_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * Cross-tab theme synchronization.
 *
 * Listens for theme broadcasts from other tabs and applies them
 * via the existing setTheme() from the theme provider. The theme
 * provider's setTheme is wrapped so that local theme changes also
 * broadcast to other tabs.
 */
export function useThemeBroadcast(): void {
  const { theme, setTheme } = useTheme();
  const channelRef = useRef<BroadcastChannel | null>(null);
  // Track the last-applied theme to avoid re-broadcasting a
  // received message (infinite-loop guard).
  const lastAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(THEME_CHANNEL);
    channelRef.current = channel;

    const handleMessage = (event: MessageEvent<ThemeBroadcastMessage>) => {
      const msg = event.data;
      if (!msg || msg.origin === INSTANCE_ID) return;
      if (msg.theme === lastAppliedRef.current) return; // no-op
      lastAppliedRef.current = msg.theme;
      setTheme(msg.theme as Parameters<typeof setTheme>[0]);
    };
    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [setTheme]);

  // ── Broadcast local theme changes ───────────────────────────
  // Watch the `theme` value from the provider. When it changes
  // AND the change didn't come from a broadcast (i.e.,
  // lastAppliedRef doesn't match), broadcast it.
  useEffect(() => {
    if (lastAppliedRef.current === theme) return; // came from a broadcast
    const channel = channelRef.current;
    if (!channel) return;
    try {
      channel.postMessage({
        theme,
        origin: INSTANCE_ID,
        timestamp: Date.now(),
      } satisfies ThemeBroadcastMessage);
    } catch (err) {
      console.warn("[useThemeBroadcast] Failed to broadcast theme:", err);
    }
    lastAppliedRef.current = theme;
  }, [theme]);
}
