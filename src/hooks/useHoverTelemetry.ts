import { useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface TelemetryEvent {
  sponsor_id: string;
  user_id: string | null;
  hover_duration_ms: number;
  clicked: boolean;
}

const BATCH_QUEUE: TelemetryEvent[] = [];
let isFlushing = false;

const flushQueue = async () => {
  if (BATCH_QUEUE.length === 0 || isFlushing) return;
  isFlushing = true;

  const batch = [...BATCH_QUEUE];
  BATCH_QUEUE.length = 0; // clear

  try {
    const supabase = createClient();
    await supabase.from("sponsor_telemetry").insert(batch);
  } catch (error) {
    console.error("Failed to flush telemetry:", error);
    // Put back if failed
    BATCH_QUEUE.push(...batch);
  } finally {
    isFlushing = false;
  }
};

const scheduleFlush = () => {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    (window as any).requestIdleCallback(() => flushQueue());
  } else {
    setTimeout(() => flushQueue(), 1000);
  }
};

export function useHoverTelemetry(sponsorId: string, userId?: string | null) {
  const enterTimeRef = useRef<number | null>(null);

  const onMouseEnter = useCallback(() => {
    enterTimeRef.current = Date.now();
  }, []);

  const onMouseLeave = useCallback(() => {
    if (enterTimeRef.current) {
      const duration = Date.now() - enterTimeRef.current;
      enterTimeRef.current = null;

      // Only track meaningful hovers (e.g., > 100ms) to avoid noise
      if (duration > 100) {
        BATCH_QUEUE.push({
          sponsor_id: sponsorId,
          user_id: userId || null,
          hover_duration_ms: duration,
          clicked: false,
        });
        scheduleFlush();
      }
    }
  }, [sponsorId, userId]);

  const onClick = useCallback(() => {
    let duration = 0;
    if (enterTimeRef.current) {
      duration = Date.now() - enterTimeRef.current;
      enterTimeRef.current = null; // reset so mouseleave doesn't double count if they navigate away
    }

    BATCH_QUEUE.push({
      sponsor_id: sponsorId,
      user_id: userId || null,
      hover_duration_ms: duration,
      clicked: true,
    });
    scheduleFlush();
  }, [sponsorId, userId]);

  // Clean up if unmounted while hovering
  useEffect(() => {
    return () => {
      if (enterTimeRef.current) {
        const duration = Date.now() - enterTimeRef.current;
        if (duration > 100) {
          BATCH_QUEUE.push({
            sponsor_id: sponsorId,
            user_id: userId || null,
            hover_duration_ms: duration,
            clicked: false,
          });
          scheduleFlush();
        }
      }
    };
  }, [sponsorId, userId]);

  return { onMouseEnter, onMouseLeave, onClick };
}
