// src/hooks/useBroadcastState.ts
//
// useBroadcastState — Cross-Tab State Synchronization (Issue #2692)
//
// A custom React hook that wraps useState and synchronizes the state
// across all open browser tabs/windows of the same origin via the
// BroadcastChannel API.
//
// Usage:
//   const [theme, setTheme] = useBroadcastState("theme", "dark");
//   setTheme("light"); // instantly updates all other tabs
//
// Infinite-loop protection:
//   Each broadcast message carries an `origin` field set to a
//   per-instance UUID. When a message arrives, the receiving tab
//   updates its local state SILENTLY (without re-broadcasting), so
//   the chain terminates after one hop per origin tab.
//
// Graceful degradation:
//   If BroadcastChannel is unavailable (older browsers, SSR), the
//   hook degrades to plain useState — the state still works locally,
//   it just doesn't sync across tabs.

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The shape of every message posted on the broadcast channel.
 */
interface BroadcastMessage<T> {
  /** The new state value. */
  value: T;
  /** A per-instance UUID so receivers can ignore their own echoes. */
  origin: string;
  /** Monotonic timestamp to break ties when two tabs race. */
  timestamp: number;
}

/**
 * Generate a reasonably-unique per-instance id without pulling in
 * the `uuid` package. Uses crypto.randomUUID when available, falls
 * back to Math.random + Date.now.
 */
function generateInstanceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * A cross-tab synchronized state hook.
 *
 * @param channelName The BroadcastChannel name. All tabs using the
 *   same channelName will sync their state.
 * @param initialState The initial state (or a lazy initializer).
 * @returns A tuple `[state, setState]` just like useState. The
 *   `setState` function, when called, updates local state AND
 *   broadcasts to all other tabs.
 */
export function useBroadcastState<T>(
  channelName: string,
  initialState: T | (() => T),
): [T, (value: T | ((prev: T) => T)) => void] {
  // Resolve the lazy initializer once.
  const [state, setStateInternal] = useState<T>(initialState);

  // Per-instance origin id — used to ignore our own echoes and
  // to prevent the infinite-loop chain (Tab A → Tab B → Tab A …).
  const originRef = useRef<string>(generateInstanceId());

  // The BroadcastChannel instance, kept in a ref so it survives
  // re-renders. Null when BroadcastChannel is unavailable.
  const channelRef = useRef<BroadcastChannel | null>(null);

  // ── Open the channel on mount, close on unmount ──────────────
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      // SSR or unsupported browser — degrade to plain useState.
      return;
    }

    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    const handleMessage = (event: MessageEvent<BroadcastMessage<T>>) => {
      const msg = event.data;
      if (!msg || msg.origin === originRef.current) {
        // Ignore our own echoes — this is the infinite-loop guard.
        return;
      }
      // Update local state SILENTLY (no re-broadcast). This is
      // the key to breaking the chain: the receiver does NOT
      // call the broadcast version of setState.
      setStateInternal(msg.value);
    };

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [channelName]);

  // ── setState: update local + broadcast ───────────────────────
  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStateInternal((prev) => {
        const next = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;

        // Broadcast the new value to other tabs. Only
        // broadcast if the channel is open and the value
        // actually changed (prevents spamming no-op updates).
        const channel = channelRef.current;
        if (channel && next !== prev) {
          try {
            channel.postMessage({
              value: next,
              origin: originRef.current,
              timestamp: Date.now(),
            } satisfies BroadcastMessage<T>);
          } catch (err) {
            // BroadcastChannel can throw if the channel
            // is closed or the value isn't cloneable.
            // Log but don't crash — local state still
            // updated.
            console.warn(`[useBroadcastState] Failed to broadcast on "${channelName}":`, err);
          }
        }

        return next;
      });
    },
    [channelName],
  );

  return [state, setState];
}

/**
 * Detect whether the BroadcastChannel API is available in the
 * current environment. Useful for conditional UI ("sync is on").
 */
export function isBroadcastSupported(): boolean {
  return typeof window !== "undefined" && typeof BroadcastChannel !== "undefined";
}
