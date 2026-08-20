// src/hooks/useArrivalBoard.ts
// -----------------------------------------------------------------------------
// Issue #3753 — Automated Speaker Travel Itinerary & Arrival Buffer Coordination
//
// Loads every inbound (or outbound) speaker journey for an event and projects
// each one's campus arrival, sorted so the person most likely to miss their own
// session is at the top.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  projectArrival,
  sortByRisk,
  type ArrivalProjection,
  type ItineraryDirection,
  type ItineraryLeg,
  type SpeakerItinerary,
  type TravelMode,
} from "@/lib/speakerItinerary";

/** Leg shape as nested by the `get_event_arrival_board` RPC. */
interface RawLeg {
  id: string;
  sequence: number;
  mode: TravelMode;
  carrier: string | null;
  reference: string | null;
  origin: string;
  destination: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  delayMinutes: number | null;
}

interface BoardRow {
  itinerary_id: string;
  speaker_name: string;
  speaker_contact: string | null;
  direction: ItineraryDirection;
  call_time: string;
  session_title: string | null;
  host_name: string | null;
  ground_transfer_minutes: number;
  status: string;
  legs: RawLeg[] | null;
}

export interface UseArrivalBoardResult {
  projections: ArrivalProjection[];
  /** Journeys that need an organiser to act, worst first. */
  atRisk: ArrivalProjection[];
  /** Speakers with no host assigned — the handoff nobody owns. */
  unhosted: ArrivalProjection[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  reportDelay: (legId: string, minutes: number) => Promise<void>;
}

function toLeg(raw: RawLeg): ItineraryLeg {
  return {
    id: raw.id,
    sequence: raw.sequence,
    mode: raw.mode,
    carrier: raw.carrier,
    reference: raw.reference,
    origin: raw.origin,
    destination: raw.destination,
    scheduledDeparture: raw.scheduledDeparture,
    scheduledArrival: raw.scheduledArrival,
    delayMinutes: raw.delayMinutes ?? 0,
  };
}

function toItinerary(row: BoardRow): SpeakerItinerary {
  return {
    id: row.itinerary_id,
    speakerName: row.speaker_name,
    direction: row.direction,
    callTime: row.call_time,
    sessionTitle: row.session_title,
    hostName: row.host_name,
    groundTransferMinutes: row.ground_transfer_minutes,
    legs: (row.legs ?? []).map(toLeg),
  };
}

export function useArrivalBoard(
  eventId: string | null | undefined,
  direction: ItineraryDirection = "inbound",
): UseArrivalBoardResult {
  const [itineraries, setItineraries] = useState<SpeakerItinerary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("get_event_arrival_board", {
        p_event_id: eventId,
        p_direction: direction,
      });
      if (rpcError) throw rpcError;

      const rows = (data ?? []) as BoardRow[];
      setItineraries(rows.map(toItinerary));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load the arrival board";
      setError(message);
      setItineraries([]);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, direction]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  const projections = useMemo(() => sortByRisk(itineraries.map(projectArrival)), [itineraries]);

  const atRisk = useMemo(() => projections.filter((p) => p.band !== "comfortable"), [projections]);

  const unhosted = useMemo(() => projections.filter((p) => !p.hostName), [projections]);

  const reportDelay = useCallback(
    async (legId: string, minutes: number) => {
      const supabase = createClient();

      // Update locally first so the buffer and risk band re-compute the moment
      // the organiser enters the delay, rather than after a round trip.
      setItineraries((previous) =>
        previous.map((itinerary) => ({
          ...itinerary,
          legs: itinerary.legs.map((leg) =>
            leg.id === legId ? { ...leg, delayMinutes: minutes } : leg,
          ),
        })),
      );

      const { error: rpcError } = await supabase.rpc("report_leg_delay", {
        p_leg_id: legId,
        p_minutes: minutes,
      });

      if (rpcError) {
        // The server rejects implausible delays; re-fetch so the board shows
        // the truth rather than the rejected optimistic value.
        setError(rpcError.message);
        await fetchBoard();
      }
    },
    [fetchBoard],
  );

  return {
    projections,
    atRisk,
    unhosted,
    isLoading,
    error,
    refresh: fetchBoard,
    reportDelay,
  };
}
