import { useRef, useCallback } from "react";
import { queryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";

// How long the mouse must stay over the card before we start prefetching.
const HOVER_PREFETCH_DELAY_MS = 200;

/**
 * usePreloadEvent(eventId)
 *
 * Returns mouse handlers you can spread onto an EventCard so that hovering
 * over it for more than 200ms quietly fetches the full event details in the
 * background and stores them in the React Query cache under ["event", eventId] —
 * the same key used by the event detail route (src/routes/events.$eventId.tsx).
 *
 * If the user moves the mouse away before the delay finishes, the pending
 * fetch is cancelled and nothing happens.
 */
export function usePreloadEvent(eventId: string) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (!eventId) return;

    timeoutRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ["event", eventId],
        queryFn: async () => {
          const supabase = createClient();
          const { data, error } = await supabase
            .from("events")
            .select(
              `
              id, title, description, event_date, start_date, end_date, location, banner_url, created_by, max_attendees, requires_approval,
              clubs (name, slug),
              event_rsvps (id, user_id, status, checked_in, rsvp_at, profiles (first_name, last_name, avatar_url)),
              event_waitlist (id, user_id, created_at, profiles (first_name, last_name, avatar_url))
            `,
            )
            .eq("id", eventId)
            .single();

          if (error) throw error;
          return data;
        },
      });
    }, HOVER_PREFETCH_DELAY_MS);
  }, [eventId]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave };
}
