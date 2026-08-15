import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";

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

interface PresenceContextType {
  onlineUsers: number;
  presenceMap: Record<string, PresenceStateEntry>;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceStateEntry>>({});
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setOnlineUsers(0);
      setPresenceMap({});
      return;
    }

    const forceLeftUsers = new Set<string>();
    const channel = supabase.channel("campus_online", {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    const updatePresence = () => {
      if (updateTimeoutRef.current) return;
      updateTimeoutRef.current = setTimeout(() => {
        updateTimeoutRef.current = null;
        const state = channel.presenceState();
        const map = buildPresenceMap(state as any);
        const activeKeys = Object.keys(map).filter((key) => !forceLeftUsers.has(key));
        setPresenceMap(map);
        setOnlineUsers(activeKeys.length);
      }, 500); // Throttle status updates to optimize performance & limit re-renders
    };

    channel
      .on("presence", { event: "sync" }, updatePresence)
      .on("presence", { event: "join" }, updatePresence)
      .on("presence", { event: "leave" }, updatePresence)
      .on("broadcast", { event: "ghost-leave" }, ({ payload }) => {
        if (payload?.userId) {
          forceLeftUsers.add(String(payload.userId));
          updatePresence();
        }
      });

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await channel.track({
        userId: user.id,
        status: "online",
        lastSeen: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // Heartbeat tracking
    const heartbeatTimer = setInterval(async () => {
      const payload: PresencePayload = {
        userId: user.id,
        status: "online",
        lastSeen: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await supabase.from("presence_heartbeats").upsert({
        user_id: user.id,
        last_pinged_at: new Date().toISOString(),
      });

      await channel.track(payload);
    }, HEARTBEAT_INTERVAL_MS);

    // Idle monitoring
    let activeTimer: ReturnType<typeof setTimeout> | null = null;

    const markIdle = () => {
      void channel.track({
        userId: user.id,
        status: "idle",
        lastSeen: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    };

    const scheduleIdle = () => {
      if (activeTimer) clearTimeout(activeTimer);
      activeTimer = setTimeout(markIdle, IDLE_TIMEOUT_MS);
    };

    const handleActivity = () => {
      void channel.track({
        userId: user.id,
        status: "online",
        lastSeen: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      scheduleIdle();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (activeTimer) clearTimeout(activeTimer);
        void channel.track({
          userId: user.id,
          status: "offline",
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        handleActivity();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("click", handleActivity, { passive: true });

    scheduleIdle();

    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      if (activeTimer) clearTimeout(activeTimer);
      clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);

      void channel.track({
        userId: user.id,
        status: "offline",
        lastSeen: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      channel.unsubscribe();
    };
  }, [user, supabase]);

  const value = useMemo(() => ({ onlineUsers, presenceMap }), [onlineUsers, presenceMap]);
  return React.createElement(PresenceContext.Provider, { value }, children);
};

export function usePresence(userId?: string) {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }

  const isOnline = useMemo(() => {
    if (!userId) return false;
    return context.presenceMap[userId]?.status === "online";
  }, [context.presenceMap, userId]);

  return useMemo(
    () => ({
      onlineUsers: context.onlineUsers,
      presenceMap: context.presenceMap,
      isOnline,
    }),
    [context.onlineUsers, context.presenceMap, isOnline],
  );
}
