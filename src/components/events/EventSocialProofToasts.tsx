import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Flame } from "lucide-react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useSupabaseSubscription } from "@/hooks/useSupabaseSubscription";
import { supabase } from "@/lib/supabase/client";
import { getEventRsvpState } from "@/lib/waitlist";

/**
 * Social-proof toasts for the event page (#2976).
 *
 * Subscribes to realtime changes on `event_rsvps` for the event. INSERTs
 * drive small bottom-left toasts ("Alex just RSVP'd!"); any change refreshes
 * the capacity warning so it never goes stale. RSVPs arriving within a short
 * window are aggregated into a single toast, and toasts are queued so at
 * most one is on screen at a time. Rows are deduplicated by their stable id
 * so replayed events never double-fire. When no live activity arrives while
 * viewing, the last few RSVPs from the past hour are replayed on a staggered
 * timer. A persistent red warning is shown while `capacity - attending <= 5`.
 * Names come from the same public `profiles` lookup the rest of the app
 * uses; unresolved profiles fall back to "Someone". The realtime payload
 * itself never carries PII.
 */

const LOW_CAPACITY_THRESHOLD = 5;
const AGGREGATION_WINDOW_MS = 3000;
const TOAST_DURATION_MS = 4000;
const FALLBACK_GRACE_MS = 5000;
const FALLBACK_STAGGER_MS = 10000;
const FALLBACK_MAX_RSVPS = 3;

type RsvpRow = {
  id: string;
  user_id: string;
  status: string;
  rsvp_at: string;
};

type SocialProofToast = {
  id: string;
  message: string;
};

interface EventSocialProofToastsProps {
  eventId: string;
}

export const EventSocialProofToasts: React.FC<EventSocialProofToastsProps> = ({ eventId }) => {
  const [queue, setQueue] = useState<SocialProofToast[]>([]);
  const [current, setCurrent] = useState<SocialProofToast | null>(null);
  const [spotsLeft, setSpotsLeft] = useState<number | null>(null);

  const mountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);
  const seenRsvpIdsRef = useRef(new Set<string>());
  const hasLiveActivityRef = useRef(false);
  const batchRef = useRef<{ timer: number | null; rsvps: RsvpRow[] }>({ timer: null, rsvps: [] });
  const displayTimerRef = useRef<number | null>(null);
  const fallbackTimersRef = useRef<number[]>([]);
  const burstCounterRef = useRef(0);

  const enqueueToast = useCallback((toast: SocialProofToast) => {
    setQueue((prev) => [...prev, toast]);
  }, []);

  const enqueueRsvpToast = useCallback(
    async (rsvp: RsvpRow) => {
      if (!mountedRef.current) return;
      let name: string | null = null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", rsvp.user_id)
        .maybeSingle();
      if (data?.full_name) name = data.full_name;
      if (!mountedRef.current) return;
      enqueueToast({
        id: rsvp.id,
        message: name ? `${name} just RSVP'd!` : "Someone just RSVP'd!",
      });
    },
    [enqueueToast],
  );

  const refreshCapacity = useCallback(async () => {
    const state = await getEventRsvpState(eventId);
    if (!state || !mountedRef.current) return;
    const remaining =
      state.max_attendees != null ? state.max_attendees - state.attending_count : null;
    if (remaining != null && remaining <= LOW_CAPACITY_THRESHOLD) {
      setSpotsLeft(Math.max(0, remaining));
    } else {
      setSpotsLeft(null);
    }
  }, [eventId]);

  const flushBatch = useCallback(() => {
    const batch = batchRef.current;
    batch.timer = null;
    const rsvps = batch.rsvps.splice(0);
    if (rsvps.length === 0) return;
    void refreshCapacity();
    if (rsvps.length === 1) {
      void enqueueRsvpToast(rsvps[0]);
    } else {
      burstCounterRef.current += 1;
      enqueueToast({
        id: `burst-${burstCounterRef.current}`,
        message: `${rsvps.length} people just RSVP'd!`,
      });
    }
  }, [enqueueRsvpToast, enqueueToast, refreshCapacity]);

  const handleRsvpChange = useCallback(
    (payload: RealtimePostgresChangesPayload<RsvpRow>) => {
      if (payload.eventType === "INSERT") {
        const row = payload.new as RsvpRow;
        if (
          row?.id &&
          row.status === "attending" &&
          (!currentUserIdRef.current || row.user_id !== currentUserIdRef.current) &&
          !seenRsvpIdsRef.current.has(row.id)
        ) {
          seenRsvpIdsRef.current.add(row.id);
          hasLiveActivityRef.current = true;

          const batch = batchRef.current;
          batch.rsvps.push(row);
          if (batch.timer == null) {
            batch.timer = window.setTimeout(flushBatch, AGGREGATION_WINDOW_MS);
          }
          return;
        }
      }
      // Cancellations and promotions change attendance — keep the warning honest.
      void refreshCapacity();
    },
    [flushBatch, refreshCapacity],
  );

  useSupabaseSubscription<RsvpRow>({
    table: "event_rsvps",
    event: "*",
    filter: `event_id=eq.${eventId}`,
    enabled: Boolean(eventId),
    onData: handleRsvpChange,
  });

  // Resolve the current user id and own all timers so they can be cleared on unmount.
  useEffect(() => {
    mountedRef.current = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (data?.user) currentUserIdRef.current = data.user.id;
    });
    return () => {
      mountedRef.current = false;
      if (batchRef.current.timer != null) window.clearTimeout(batchRef.current.timer);
      if (displayTimerRef.current != null) window.clearTimeout(displayTimerRef.current);
      fallbackTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      fallbackTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!eventId) return;
    void refreshCapacity();
  }, [eventId, refreshCapacity]);

  // Show one toast at a time; advance the queue when the current one expires.
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
    displayTimerRef.current = window.setTimeout(() => {
      displayTimerRef.current = null;
      setCurrent(null);
    }, TOAST_DURATION_MS);
  }, [current, queue]);

  // With no live activity while viewing, replay recent RSVPs on a stagger.
  const runFallback = useCallback(async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("event_rsvps")
      .select("id, user_id, status, rsvp_at")
      .eq("event_id", eventId)
      .eq("status", "attending")
      .gte("rsvp_at", oneHourAgo)
      .order("rsvp_at", { ascending: false })
      .limit(FALLBACK_MAX_RSVPS);
    if (!data || data.length === 0 || !mountedRef.current) return;

    const recent = data.filter(
      (rsvp) => !currentUserIdRef.current || rsvp.user_id !== currentUserIdRef.current,
    );
    recent.forEach((rsvp, index) => {
      seenRsvpIdsRef.current.add(rsvp.id);
      const timer = window.setTimeout(() => {
        if (!mountedRef.current || hasLiveActivityRef.current) return;
        void enqueueRsvpToast(rsvp);
      }, index * FALLBACK_STAGGER_MS);
      fallbackTimersRef.current.push(timer);
    });
    void refreshCapacity();
  }, [eventId, enqueueRsvpToast, refreshCapacity]);

  useEffect(() => {
    if (!eventId) return;
    const graceTimer = window.setTimeout(() => {
      if (hasLiveActivityRef.current) return;
      void runFallback();
    }, FALLBACK_GRACE_MS);
    fallbackTimersRef.current.push(graceTimer);
    return () => {
      // Also clears on eventId changes (e.g. navigating between events), not
      // just on unmount, so stale timers can never fire on a different event.
      window.clearTimeout(graceTimer);
      fallbackTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      fallbackTimersRef.current = [];
      if (batchRef.current.timer != null) {
        window.clearTimeout(batchRef.current.timer);
        batchRef.current.timer = null;
        batchRef.current.rsvps = [];
      }
    };
  }, [eventId, runFallback]);

  if (!eventId) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, x: -32, y: 12 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -32, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="flex items-center gap-2 rounded-lg border-2 border-black bg-white px-4 py-2.5 font-mono text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />
            {current.message}
          </motion.div>
        )}
        {spotsLeft != null && (
          <motion.div
            key="capacity-warning"
            role="alert"
            initial={{ opacity: 0, x: -32, y: 12 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -32, y: 12 }}
            className="flex items-center gap-2 rounded-lg border-2 border-red-600 bg-red-50 px-4 py-2.5 font-mono text-sm font-bold text-red-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
            {spotsLeft === 0 ? "Event is full!" : `Only ${spotsLeft} spots left!`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
