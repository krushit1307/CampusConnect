import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PresenceStatus = "online" | "idle" | "offline";

export interface PresencePayload {
  userId?: string;
  status: PresenceStatus;
  lastSeen: string;
  updatedAt?: string;
}

export interface PresenceStateEntry {
  userId: string;
  status: PresenceStatus;
  lastSeen: string;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const IDLE_TIMEOUT_MS = 5 * 60_000;

function getNow() {
  return Date.now();
}

export function buildPresenceMap(
  rawState: Record<string, Array<Record<string, unknown>> | undefined>,
): Record<string, PresenceStateEntry> {
  return Object.entries(rawState).reduce<Record<string, PresenceStateEntry>>(
    (acc, [key, entries]) => {
      const entry = entries?.[0] as Partial<PresencePayload> | undefined;
      if (!entry?.userId) {
        return acc;
      }

      const lastSeen = String(entry.lastSeen ?? entry.updatedAt ?? new Date().toISOString());
      const status =
        entry.status === "offline"
          ? "offline"
          : entry.status === "idle"
            ? "idle"
            : getPresenceStatus(lastSeen);
      acc[key] = {
        userId: String(entry.userId),
        status,
        lastSeen,
      };

      return acc;
    },
    {},
  );
}

export function getPresenceBadgeClass(status: PresenceStatus) {
  switch (status) {
    case "online":
      return "inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]";
    case "idle":
      return "inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]";
    default:
      return "inline-flex h-2.5 w-2.5 rounded-full bg-gray-400";
  }
}

export function getPresenceStatus(lastSeen: string) {
  const age = getNow() - new Date(lastSeen).getTime();
  if (Number.isNaN(age)) {
    return "offline" as const;
  }
  if (age > IDLE_TIMEOUT_MS) {
    return "offline" as const;
  }
  if (age > 60_000) {
    return "idle" as const;
  }
  return "online" as const;
}

export function usePresence(userId?: string) {
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceStateEntry>>({});

  useEffect(() => {
    if (!userId) {
      setOnlineUsers(0);
      setPresenceMap({});
      return;
    }

    const supabase = createClient();
    const forceLeftUsers = new Set<string>();
    const channel = supabase.channel("campus_online", {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    const updatePresence = () => {
      const state = channel.presenceState();
      const map = buildPresenceMap(
        state as Record<string, Array<Record<string, unknown>> | undefined>,
      );
      const activeKeys = Object.keys(map).filter((key) => !forceLeftUsers.has(key));

      setPresenceMap(map);
      setOnlineUsers(activeKeys.length);
    };

    channel
      .on("presence", { event: "sync" }, () => {
        updatePresence();
      })
      .on("presence", { event: "join" }, () => {
        updatePresence();
      })
      .on("presence", { event: "leave" }, () => {
        updatePresence();
      })
      .on("broadcast", { event: "ghost-leave" }, ({ payload }) => {
        if (payload?.userId) {
          forceLeftUsers.add(String(payload.userId));
          updatePresence();
        }
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;

        await channel.track({
          userId,
          status: "online",
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let activeTimer: ReturnType<typeof setTimeout> | null = null;

    const sendHeartbeat = async () => {
      const payload: PresencePayload = {
        userId,
        status: "online",
        lastSeen: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { error } = await supabase.from("presence_heartbeats").upsert({
        user_id: userId,
        last_pinged_at: new Date().toISOString(),
      });

      if (error) {
        console.error("[usePresence] Heartbeat ping failed:", error);
        return;
      }

      await channel.track(payload);
    };

    const markIdle = () => {
      void channel.track({
        userId,
        status: "idle",
        lastSeen: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    };

    const scheduleIdle = () => {
      if (activeTimer) clearTimeout(activeTimer);
      activeTimer = setTimeout(markIdle, IDLE_TIMEOUT_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (activeTimer) clearTimeout(activeTimer);
        void channel.track({
          userId,
          status: "offline",
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      void sendHeartbeat();
      scheduleIdle();
    };

    const handleActivity = () => {
      void sendHeartbeat();
      scheduleIdle();
    };

    const startHeartbeat = () => {
      void sendHeartbeat();
      heartbeatTimer = setInterval(() => {
        void sendHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);
      scheduleIdle();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("click", handleActivity, { passive: true });

    startHeartbeat();

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (activeTimer) clearTimeout(activeTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      void channel.track({
        userId,
        status: "offline",
        lastSeen: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      void channel.unsubscribe();
    };
  }, [userId]);

  return useMemo(() => ({ onlineUsers, presenceMap }), [onlineUsers, presenceMap]);
}
