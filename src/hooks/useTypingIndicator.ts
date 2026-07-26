import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Typing indicator hook backed by Supabase Realtime Presence.
 *
 * Each participant tracks their presence state on a shared channel.
 * When a user types, their presence is updated to `{ typing: true }`.
 * After 3 seconds of inactivity the state is reset to `{ typing: false }`.
 *
 * @param channelName  Unique channel key, e.g. `"chat:userId1_userId2"`
 * @param userId       The current user's ID (used as the presence key)
 * @param username     The current user's display name (shown in the indicator)
 */
export function useTypingIndicator(channelName: string, userId: string, username: string) {
  // Names of OTHER users currently typing (never includes self)
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const supabaseRef = useRef(createClient());
  const channelRef = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null);
  // Debounce timer: resets typing state to false after 3 s of inactivity
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  // Throttle flag: prevents flooding the channel with presence updates
  const throttleRef = useRef(false);

  useEffect(() => {
    if (!channelName || !userId) return;

    const supabase = supabaseRef.current;

    // Use userId as the presence key so each participant occupies a unique slot
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: userId },
      },
    });

    channelRef.current = channel;

    channel
      // Presence sync fires on join, leave, and any track() update
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ typing: boolean; username: string }>();

        // Collect display names of OTHER users whose typing flag is true
        const names = Object.entries(state)
          .filter(([presenceKey]) => presenceKey !== userId)
          .flatMap(([, presences]) => presences)
          .filter((p) => p.typing)
          .map((p) => p.username);

        setTypingUsers(names);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        // Track initial presence: not typing
        await channel.track({ typing: false, username });
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void channel.unsubscribe();
      channelRef.current = null;
    };
    // Re-subscribe only if the channel or user identity changes
  }, [channelName, userId]);

  /**
   * Call this on every keystroke / input change.
   * Sets typing: true immediately (throttled to once per 2 s),
   * then debounces a reset to typing: false after 3 s of inactivity.
   */
  const broadcastTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;

    // Debounce: reset typing to false after 3 s of no new keystrokes
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void channel.track({ typing: false, username });
    }, 3000);

    // Throttle outgoing updates to avoid flooding (once per 2 s)
    if (throttleRef.current) return;
    throttleRef.current = true;
    void channel.track({ typing: true, username });
    setTimeout(() => {
      throttleRef.current = false;
    }, 2000);
  }, [username]);

  /**
   * Call this when a message is sent to immediately clear the typing state.
   */
  const clearTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void channel.track({ typing: false, username });
  }, [username]);

  return { typingUsers, broadcastTyping, clearTyping };
}
