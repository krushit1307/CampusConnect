import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function usePresence(userId?: string) {
  const [onlineUsers, setOnlineUsers] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const forceLeftUsers = new Set<string>();

    const channel = supabase.channel("global-presence", {
      config: {
        presence: {
          key: userId ?? crypto.randomUUID(),
        },
      },
    });

    const updatePresence = () => {
      const state = channel.presenceState();
      const activeKeys = Object.keys(state).filter((key) => !forceLeftUsers.has(key));
      setOnlineUsers(activeKeys.length);
    };

    channel
      .on("presence", { event: "sync" }, () => {
        updatePresence();
      })
      .on("broadcast", { event: "ghost-leave" }, ({ payload }) => {
        if (payload?.userId) {
          forceLeftUsers.add(payload.userId);
          updatePresence();
        }
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;

        await channel.track({
          online_at: new Date().toISOString(),
        });
      });

    // Client heartbeat: ping the presence_heartbeats table every 60 seconds
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    if (userId) {
      const sendPing = async () => {
        const { error } = await supabase
          .from("presence_heartbeats")
          .upsert({ user_id: userId, last_pinged_at: new Date().toISOString() });
        if (error) {
          console.error("[usePresence] Heartbeat ping failed:", error);
        }
      };

      // Initial ping
      void sendPing();

      pingInterval = setInterval(() => {
        void sendPing();
      }, 60000);
    }

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      void channel.unsubscribe();
    };
  }, [userId]);

  return onlineUsers;
}
