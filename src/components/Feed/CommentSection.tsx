import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface CommentSectionProps {
  postId: string;
  currentUser?: {
    id: string;
    name: string;
  };
}

interface PresencePayload {
  typing?: boolean;
  user?: string;
  [key: string]: unknown;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ postId, currentUser }) => {
  const [commentText, setCommentText] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const username = currentUser?.name || "A user";

  // 1. Subscribe to Supabase Realtime Presence Channel
  useEffect(() => {
    const channel = supabase.channel(`discussion-post:${postId}`, {
      config: { presence: { key: currentUser?.id || Math.random().toString() } },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();
        const currentlyTyping: string[] = [];

        Object.values(state).forEach((presences) => {
          if (Array.isArray(presences)) {
            (presences as PresencePayload[]).forEach((presence) => {
              if (presence.typing && presence.user && presence.user !== username) {
                currentlyTyping.push(presence.user);
              }
            });
          }
        });

        setTypingUsers(currentlyTyping);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [postId, username, currentUser?.id]);

  // 2. Broadcast typing status with auto-reset debouncer
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCommentText(e.target.value);

    if (!channelRef.current) return;

    // Broadcast that this user is currently typing
    channelRef.current.track({ typing: true, user: username });

    // Clear previous timeout if user keeps typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Automatically stop typing indicator after 2.5 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        channelRef.current.track({ typing: false, user: username });
      }
    }, 2500);
  };

  // Helper to render typing text
  const renderTypingText = useCallback(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return "Several people are typing...";
  }, [typingUsers]);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Dynamic Typing Indicator Banner */}
      {typingUsers.length > 0 && (
        <div className="text-sm italic text-muted-foreground animate-pulse">
          💬 {renderTypingText()}
        </div>
      )}

      {/* Input Box for comments */}
      <div className="flex gap-2">
        <input
          type="text"
          value={commentText}
          onChange={handleInputChange}
          placeholder="Write a comment..."
          className="w-full p-2 border rounded-md text-sm bg-background text-foreground"
        />
      </div>
    </div>
  );
};

export default CommentSection;
