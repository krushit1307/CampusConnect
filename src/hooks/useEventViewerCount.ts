import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export function useEventViewerCount(eventId: string) {
  const [viewerCount, setViewerCount] = useState(1); // Default to at least 1 (the current user)

  const sessionId = useMemo(() => Math.random().toString(36).substring(2, 15), []);

  useEffect(() => {
    if (!eventId) return;

    const supabase = createClient();

    // Create the presence channel specifically for this event ID
    const channel = supabase.channel(`room:event-${eventId}`, {
      config: {
        presence: {
          key: sessionId,
        },
      },
    });

    const updateViewerCount = () => {
      const state = channel.presenceState();
      // Count unique presence keys (each unique session ID is a key)
      const count = Object.keys(state).length;
      // Ensure we display at least 1 (the current user)
      setViewerCount(Math.max(1, count));
    };

    channel
      .on("presence", { event: "sync" }, () => {
        updateViewerCount();
      })
      .on("presence", { event: "join" }, () => {
        updateViewerCount();
      })
      .on("presence", { event: "leave" }, () => {
        updateViewerCount();
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;

        // Track the presence state with session details
        await channel.track({
          sessionId,
          onlineAt: new Date().toISOString(),
        });
      });

    return () => {
      // Cleanup: leave the channel on unmount
      void channel.unsubscribe();
    };
  }, [eventId, sessionId]);

  return viewerCount;
}
