import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Tracks how many clients are currently viewing a club's page, using
 * Supabase Realtime Presence on a channel scoped to `presence:club:{clubId}`.
 *
 * Presence has no concept of "club membership" — it only knows who is
 * currently subscribed to the channel. So this counts everyone with the
 * club page open right now (signed in or not), not specifically verified
 * club members. That matches the issue's stated behavior ("browsing the
 * club's specific page") even though the UI copy says "members online".
 *
 * Logged-in users are tracked under their auth user id, so the same
 * person open in two tabs still counts once. Signed-out visitors get a
 * random id generated once per mount, so each anonymous visitor counts
 * separately.
 */
export function usePresenceCount(clubId: string | undefined) {
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);
  const anonymousIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    if (!clubId) return;

    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const setup = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      const presenceKey = user?.id ?? anonymousIdRef.current;

      channel = supabase.channel(`presence:club:${clubId}`, {
        config: { presence: { key: presenceKey } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!channel) return;
          const state = channel.presenceState();
          setCount(Object.keys(state).length);
          setReady(true);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED" && channel) {
            void channel.track({
              user_id: presenceKey,
              online_at: new Date().toISOString(),
            });
          }
        });
    };

    void setup();

    return () => {
      cancelled = true;
      if (channel) {
        void channel.untrack();
        void supabase.removeChannel(channel);
      }
    };
  }, [clubId]);

  return { count, ready };
}
