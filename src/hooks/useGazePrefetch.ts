import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    webgazer: unknown;
  }
}

export function useGazePrefetch(enabled: boolean = false) {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [isGazeActive, setIsGazeActive] = useState(false);
  const hoverTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    // Load webgazer dynamically if not present
    if (!window.webgazer) {
      const script = document.createElement("script");
      script.src = "https://webgazer.cs.brown.edu/webgazer.js";
      script.async = true;
      script.onload = () => initWebGazer();
      document.body.appendChild(script);
    } else {
      initWebGazer();
    }

    function initWebGazer() {
      if (!window.webgazer) return;

      window.webgazer
        .setGazeListener((data: { x: number; y: number } | null) => {
          if (!data) return;

          const element = document.elementFromPoint(data.x, data.y);
          if (!element) return;

          const eventCard = element.closest("[data-event-id]") as HTMLElement | null;
          if (eventCard) {
            const eventId = eventCard.getAttribute("data-event-id");
            if (eventId && !hoverTimerRef.current.has(eventId)) {
              const timer = setTimeout(() => {
                // Pre-fetch event details via React Query after 500ms gaze dwell
                queryClient.prefetchQuery({
                  queryKey: ["event", eventId],
                  queryFn: async () => {
                    const { data: eventData } = await supabase
                      .from("events")
                      .select("*, clubs(*)")
                      .eq("id", eventId)
                      .single();
                    return eventData;
                  },
                });
              }, 500);

              hoverTimerRef.current.set(eventId, timer);
            }
          } else {
            // Clear dwell timers when gaze moves away
            hoverTimerRef.current.forEach((timer) => clearTimeout(timer));
            hoverTimerRef.current.clear();
          }
        })
        .begin();

      window.webgazer.showVideoPreview(false).showPredictionPoints(false);
      setIsGazeActive(true);
    }

    return () => {
      if (window.webgazer && isGazeActive) {
        try {
          window.webgazer.end();
        } catch (e) {
          // Cleanup error handling
        }
      }
      hoverTimerRef.current.forEach((timer) => clearTimeout(timer));
      hoverTimerRef.current.clear();
    };
  }, [enabled, queryClient, supabase, isGazeActive]);

  return { isGazeActive };
}
