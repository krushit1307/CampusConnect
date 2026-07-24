import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function usePresence(userId?: string) {
  const [onlineUsers, setOnlineUsers] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase.channel("global-presence", {
      config: {
        presence: {
          key: userId ?? crypto.randomUUID(),
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUsers(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;

        await channel.track({
          online_at: new Date().toISOString(),
        });
      });

    return () => {
      void channel.unsubscribe();
    };
  }, [userId]);

  return onlineUsers;
}
