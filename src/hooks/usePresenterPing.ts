import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  PresenterState,
  PresenterPingPayload,
  PresenterPingResponsePayload,
  createPresenterPingPayload,
  createPresenterPingResponse,
  applyPresenterPing,
  handlePresenterPingResponse,
  evaluatePresenterPingTimeout,
  playPresenterPingChime,
  DEFAULT_PING_TIMEOUT_SECONDS,
} from "@/lib/presenterPing";

export interface UsePresenterPingOptions {
  eventId: string;
  currentUserId?: string | null;
  initialPresenters?: PresenterState[];
  isOrganizer?: boolean;
  onAwolTriggered?: (presenter: PresenterState) => void;
  onConfirmedReady?: (presenterId: string) => void;
}

export function usePresenterPing({
  eventId,
  currentUserId,
  initialPresenters = [],
  isOrganizer = false,
  onAwolTriggered,
  onConfirmedReady,
}: UsePresenterPingOptions) {
  const [supabase] = useState(() => createClient());
  const [presenters, setPresenters] = useState<PresenterState[]>(initialPresenters);
  const [activePing, setActivePing] = useState<PresenterPingPayload | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  // Keep references to avoid stale closure in timers / websocket callbacks
  const presentersRef = useRef(presenters);
  presentersRef.current = presenters;

  const onAwolRef = useRef(onAwolTriggered);
  onAwolRef.current = onAwolTriggered;

  const onConfirmedRef = useRef(onConfirmedReady);
  onConfirmedRef.current = onConfirmedReady;

  // Sync initial presenters if provided
  useEffect(() => {
    if (initialPresenters.length > 0) {
      setPresenters((prev) => {
        const merged = [...initialPresenters];
        // Preserve any active ping states
        return merged.map((p) => {
          const existing = prev.find((e) => e.id === p.id);
          return existing ? { ...p, ...existing } : p;
        });
      });
    }
  }, [initialPresenters]);

  // Channel broadcast sender and listener
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Periodic interval timer to evaluate timeouts every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPresenters((prev) => {
        let changed = false;
        const updated = prev.map((p) => {
          if (p.pingStatus === "pinged") {
            const next = evaluatePresenterPingTimeout(p, now);
            if (next.pingStatus !== p.pingStatus) {
              changed = true;
              if (next.pingStatus === "awol") {
                toast.error(`⚠️ Presenter ${next.name} is AWOL! Fallback video advised.`, {
                  duration: 8000,
                });
                onAwolRef.current?.(next);
              }
              return next;
            }
          }
          return p;
        });
        return changed ? updated : prev;
      });

      // Also evaluate for current user if pinged
      if (activePing) {
        const timeoutAt = activePing.timestamp + activePing.timeoutSeconds * 1000;
        if (now >= timeoutAt) {
          setActivePing(null);
          setIsFlashing(false);
          toast.error("Readiness check timed out! Flagged as AWOL.", { duration: 6000 });
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [activePing]);

  // Setup Realtime WebSocket channel for presenter pings
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase.channel(`presenter-ping:${eventId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "ping_sent" }, ({ payload }) => {
        const ping = payload as PresenterPingPayload;
        if (!ping || !ping.presenterId) return;

        // Update presenter state in list
        setPresenters((prev) => {
          const index = prev.findIndex((p) => p.id === ping.presenterId);
          if (index !== -1) {
            const next = applyPresenterPing(prev[index], ping);
            const copy = [...prev];
            copy[index] = next;
            return copy;
          }
          // If presenter not in existing list, add them dynamically
          return [
            ...prev,
            applyPresenterPing(
              {
                id: ping.presenterId,
                name: "Presenter",
                connectionState: "connected",
                pingStatus: "idle",
              },
              ping,
            ),
          ];
        });

        // If this ping is targeted at the current active user
        if (currentUserId && ping.presenterId === currentUserId) {
          setActivePing(ping);
          setIsFlashing(true);
          playPresenterPingChime();
        }
      })
      .on("broadcast", { event: "ping_confirmed" }, ({ payload }) => {
        const response = payload as PresenterPingResponsePayload;
        if (!response || !response.presenterId) return;

        setPresenters((prev) => {
          const index = prev.findIndex((p) => p.id === response.presenterId);
          if (index !== -1) {
            const next = handlePresenterPingResponse(prev[index], response);
            const copy = [...prev];
            copy[index] = next;
            return copy;
          }
          return prev;
        });

        if (response.confirmed) {
          onConfirmedRef.current?.(response.presenterId);
          if (currentUserId === response.presenterId) {
            setActivePing(null);
            setIsFlashing(false);
            toast.success("Readiness Confirmed! You are live-ready.", { duration: 4000 });
          }
        }
      })
      .on("broadcast", { event: "presenter_awol" }, ({ payload }) => {
        const { presenterId, reason } = payload as { presenterId: string; reason?: string };
        if (!presenterId) return;

        setPresenters((prev) =>
          prev.map((p) =>
            p.id === presenterId
              ? {
                  ...p,
                  pingStatus: "awol",
                  activePingId: null,
                  failureReason: reason || "Presenter AWOL.",
                }
              : p,
          ),
        );
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, currentUserId, supabase]);

  // Action: Organizer sends a ping to a presenter
  const pingPresenter = useCallback(
    async (presenterId: string, timeoutSeconds = DEFAULT_PING_TIMEOUT_SECONDS) => {
      if (!channelRef.current) return;
      const ping = createPresenterPingPayload(eventId, presenterId, timeoutSeconds);

      // Optimistically update organizer state
      setPresenters((prev) => {
        const index = prev.findIndex((p) => p.id === presenterId);
        if (index !== -1) {
          const next = applyPresenterPing(prev[index], ping);
          const copy = [...prev];
          copy[index] = next;
          return copy;
        }
        return prev;
      });

      await channelRef.current.send({
        type: "broadcast",
        event: "ping_sent",
        payload: ping,
      });

      toast.info(`Ping sent! Waiting 15s for presenter confirmation...`, {
        duration: 3000,
      });
    },
    [eventId],
  );

  // Action: Organizer sends pings to all active presenters
  const pingAllPresenters = useCallback(
    async (timeoutSeconds = DEFAULT_PING_TIMEOUT_SECONDS) => {
      const active = presentersRef.current.filter((p) => p.connectionState === "connected");
      for (const presenter of active) {
        await pingPresenter(presenter.id, timeoutSeconds);
      }
    },
    [pingPresenter],
  );

  // Action: Presenter confirms readiness
  const confirmReady = useCallback(async () => {
    if (!activePing || !channelRef.current) return;

    const response = createPresenterPingResponse(activePing, true);

    await channelRef.current.send({
      type: "broadcast",
      event: "ping_confirmed",
      payload: response,
    });

    setActivePing(null);
    setIsFlashing(false);
  }, [activePing]);

  // Action: Mark a presenter as AWOL manually or on timeout
  const markAwol = useCallback(async (presenterId: string, reason?: string) => {
    if (!channelRef.current) return;

    setPresenters((prev) =>
      prev.map((p) =>
        p.id === presenterId
          ? {
              ...p,
              pingStatus: "awol",
              activePingId: null,
              failureReason: reason || "Presenter AWOL.",
            }
          : p,
      ),
    );

    await channelRef.current.send({
      type: "broadcast",
      event: "presenter_awol",
      payload: { presenterId, reason },
    });
  }, []);

  // Action: Reset presenter status back to idle
  const resetPresenter = useCallback((presenterId: string) => {
    setPresenters((prev) =>
      prev.map((p) =>
        p.id === presenterId
          ? {
              ...p,
              pingStatus: "idle",
              activePingId: null,
              timeoutAt: null,
              failureReason: null,
            }
          : p,
      ),
    );
  }, []);

  return {
    presenters,
    activePing,
    isFlashing,
    pingPresenter,
    pingAllPresenters,
    confirmReady,
    markAwol,
    resetPresenter,
    setPresenters,
  };
}
