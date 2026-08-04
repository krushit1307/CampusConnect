import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface Announcement {
  id: string;
  content: string;
  created_at: string;
  club_id: string;
  profiles:
    { id: string; full_name: string | null }[] | { id: string; full_name: string | null } | null;
  clubs: { id: string; name: string }[] | { id: string; name: string } | null;
}

export function useAnnouncementStream(userId: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  useEffect(() => {
    if (!userId) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      console.warn("Missing Supabase environment variables for announcement stream");
      return;
    }

    const functionUrl = `${supabaseUrl}/functions/v1/announcements-stream`;

    const connect = () => {
      const eventSource = new EventSource(functionUrl);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const announcement: Announcement = JSON.parse(event.data);

          if (processedIdsRef.current.has(announcement.id)) {
            return;
          }

          processedIdsRef.current.add(announcement.id);

          const authorName = Array.isArray(announcement.profiles)
            ? announcement.profiles[0]?.full_name || "Someone"
            : announcement.profiles?.full_name || "Someone";

          const clubName = Array.isArray(announcement.clubs)
            ? announcement.clubs[0]?.name || "a club"
            : announcement.clubs?.name || "a club";

          const preview =
            announcement.content.length > 100
              ? announcement.content.substring(0, 100) + "..."
              : announcement.content;

          toast.success(`New post from ${authorName} in ${clubName}`, {
            description: preview,
            duration: 5000,
          });
        } catch (error) {
          console.error("Failed to parse announcement:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        eventSource.close();

        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      };

      eventSource.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [userId]);

  return { eventSource: eventSourceRef.current };
}
