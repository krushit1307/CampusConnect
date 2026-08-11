import React from "react";
import * as Y from "yjs";
import { useSyncExternalStore } from "react";

interface PresenceListProps {
  provider: any; // y-supabase provider or similar awareness provider
}

export function PresenceList({ provider }: PresenceListProps) {
  // We can use a combination of local state or sync external store to subscribe to awareness changes
  const [activeUsers, setActiveUsers] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!provider) return;
    const awareness =
      typeof provider.getAwareness === "function" ? provider.getAwareness() : provider.awareness;
    if (!awareness) return;

    const updatePresence = () => {
      const states = awareness.getStates();
      const users: any[] = [];
      states.forEach((state: any) => {
        if (state.user) {
          users.push(state.user);
        }
      });
      setActiveUsers(users);
    };

    awareness.on("change", updatePresence);
    updatePresence(); // initial load

    return () => {
      awareness.off("change", updatePresence);
    };
  }, [provider]);

  if (activeUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">Active:</span>
      <div className="flex -space-x-2 overflow-hidden">
        {activeUsers.map((user, idx) => (
          <div
            key={idx}
            className="inline-block h-8 w-8 rounded-full border-2 border-black"
            style={{ backgroundColor: user.color || "#000" }}
            title={user.name || "Anonymous"}
          >
            <div className="flex h-full w-full items-center justify-center font-mono text-xs font-bold text-white mix-blend-difference">
              {(user.name || "A")[0].toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
