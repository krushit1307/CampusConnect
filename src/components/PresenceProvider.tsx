import React, { createContext, useContext } from "react";
import { usePresence, PresenceStateEntry } from "@/hooks/usePresence";
import { useAuthHydration } from "@/hooks/useAuthHydration";

interface PresenceContextType {
  onlineUsersCount: number;
  presenceMap: Record<string, PresenceStateEntry>;
  isOnline: (userId: string | undefined) => boolean;
}

const PresenceContext = createContext<PresenceContextType>({
  onlineUsersCount: 0,
  presenceMap: {},
  isOnline: () => false,
});

export const useGlobalPresence = () => useContext(PresenceContext);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthHydration();
  const userId = user?.id;
  const { presenceMap } = usePresence(userId);

  const onlineUsersCount = Object.keys(presenceMap).length;

  const isOnline = (id: string | undefined) => {
    if (!id) return false;
    return presenceMap[id]?.status === "online";
  };

  return (
    <PresenceContext.Provider value={{ onlineUsersCount, presenceMap, isOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}
