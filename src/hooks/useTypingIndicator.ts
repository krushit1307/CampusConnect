import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export function useTypingIndicator(channelName: string, username: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const broadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isBroadcastingRef = useRef(false);

  useEffect(() => {
    if (!channelName) return;

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const typingUser = payload.payload?.user;
        if (!typingUser || typingUser === username) return;

        setTypingUsers((prev) => {
          if (!prev.includes(typingUser)) {
            return [...prev, typingUser];
          }
          return prev;
        });

        // Clear existing timeout for this user
        if (typingTimeoutsRef.current[typingUser]) {
          clearTimeout(typingTimeoutsRef.current[typingUser]);
        }

        // Set new timeout to remove the user
        typingTimeoutsRef.current[typingUser] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((user) => user !== typingUser));
          delete typingTimeoutsRef.current[typingUser];
        }, 3000);
      })
      .subscribe();

    return () => {
      // Cleanup timeouts
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      if (broadcastTimeoutRef.current) clearTimeout(broadcastTimeoutRef.current);
      channel.unsubscribe();
    };
  }, [channelName, username]);

  const broadcastTyping = useCallback(() => {
    if (!channelRef.current || isBroadcastingRef.current) return;

    // Send the broadcast event
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user: username },
    });

    // Prevent spamming
    isBroadcastingRef.current = true;
    broadcastTimeoutRef.current = setTimeout(() => {
      isBroadcastingRef.current = false;
    }, 2000); // 2 second debounce/throttle for outgoing messages
  }, [username]);

  return { typingUsers, broadcastTyping };
}
