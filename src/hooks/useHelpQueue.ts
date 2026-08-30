// src/hooks/useHelpQueue.ts
// -----------------------------------------------------------------------------
// Issue: #3938 — Build a 'Real-Time "Help Desk" Queue' for Hackathons
//
// React hook that:
//   - Fetches all help tickets for an event (open + recently closed).
//   - Subscribes to the `help_queue_event_<eventId>` Supabase Realtime
//     channel so the UI re-renders the instant a new ticket is submitted,
//     claimed, or resolved.
//   - Exposes `submitTicket`, `claimTicket`, `resolveTicket`,
//     `cancelTicket`, and `getMyPosition` actions.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  helpQueueChannelName,
  type HelpTicket,
  type ClaimTicketResult,
  type TicketActionResult,
  type QueuePositionResult,
} from "@/lib/helpQueue";

export interface UseHelpQueueResult {
  tickets: HelpTicket[];
  isLoading: boolean;
  error: string | null;
  isRealtimeConnected: boolean;
  submitTicket: (input: {
    team_name: string;
    table_number: string;
    issue_description: string;
  }) => Promise<HelpTicket | null>;
  claimTicket: (ticketId: string) => Promise<ClaimTicketResult>;
  resolveTicket: (ticketId: string) => Promise<TicketActionResult>;
  cancelTicket: (ticketId: string) => Promise<TicketActionResult>;
  getMyPosition: (ticketId: string) => Promise<QueuePositionResult>;
  refresh: () => Promise<void>;
}

const RECENT_TICKET_LIMIT = 50;

export function useHelpQueue(
  eventId: string | null | undefined,
): UseHelpQueueResult {
  const supabaseRef = useRef(createClient());
  const [tickets, setTickets] = useState<HelpTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    setError(null);
    try {
      const supabase = supabaseRef.current;
      const { data, error: fetchErr } = await supabase
        .from("help_queue")
        .select(
          "id, event_id, requested_by, team_name, table_number, " +
            "issue_description, status, mentor_id, " +
            "created_at, claimed_at, resolved_at, updated_at, " +
            "mentor:mentor_id(first_name, last_name)",
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(RECENT_TICKET_LIMIT);

      if (fetchErr) throw fetchErr;

      const rows = (data ?? []) as (HelpTicket & {
        mentor?: {
          first_name: string | null;
          last_name: string | null;
        } | null;
      })[];

      const parsed: HelpTicket[] = rows.map((r) => {
        const mentorName = r.mentor
          ? [r.mentor.first_name, r.mentor.last_name]
              .filter(Boolean)
              .join(" ")
          : null;
        return {
          id: r.id,
          event_id: r.event_id,
          requested_by: r.requested_by,
          team_name: r.team_name,
          table_number: r.table_number,
          issue_description: r.issue_description,
          status: r.status,
          mentor_id: r.mentor_id,
          created_at: r.created_at,
          claimed_at: r.claimed_at,
          resolved_at: r.resolved_at,
          updated_at: r.updated_at,
          mentor_name: mentorName,
        };
      });

      setTickets(parsed);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load help queue";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (!eventId) return;
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(helpQueueChannelName(eventId))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "help_queue",
          filter: `event_id=eq.${eventId}`,
        },
        () => void fetchTickets(),
      )
      .on("broadcast", { event: "ticket_submitted" }, () => {
        void fetchTickets();
      })
      .subscribe((status) => {
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchTickets]);

  const submitTicket = useCallback(
    async (input: {
      team_name: string;
      table_number: string;
      issue_description: string;
    }): Promise<HelpTicket | null> => {
      if (!eventId) throw new Error("Event ID is required");
      const supabase = supabaseRef.current;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error: insertErr } = await supabase
        .from("help_queue")
        .insert({
          event_id: eventId,
          requested_by: user.id,
          team_name: input.team_name,
          table_number: input.table_number,
          issue_description: input.issue_description,
          status: "open",
        })
        .select("*")
        .single();

      if (insertErr) throw insertErr;
      const created = data as HelpTicket;

      // Broadcast immediately so the Mentor Dashboard sees the new ticket
      // before the postgres_changes event arrives (~200ms latency).
      const channel = supabase.channel(helpQueueChannelName(eventId));
      await channel.send({
        type: "broadcast",
        event: "ticket_submitted",
        payload: { ticket_id: created.id },
      });
      supabase.removeChannel(channel);

      void fetchTickets();
      return created;
    },
    [eventId, fetchTickets],
  );

  const claimTicket = useCallback(
    async (ticketId: string): Promise<ClaimTicketResult> => {
      const supabase = supabaseRef.current;
      const { data, error: rpcErr } = await supabase.rpc("claim_help_ticket", {
        p_ticket_id: ticketId,
      });
      if (rpcErr) throw rpcErr;
      const result = data as ClaimTicketResult;
      void fetchTickets();
      return result;
    },
    [fetchTickets],
  );

  const resolveTicket = useCallback(
    async (ticketId: string): Promise<TicketActionResult> => {
      const supabase = supabaseRef.current;
      const { data, error: rpcErr } = await supabase.rpc("resolve_help_ticket", {
        p_ticket_id: ticketId,
      });
      if (rpcErr) throw rpcErr;
      const result = data as TicketActionResult;
      void fetchTickets();
      return result;
    },
    [fetchTickets],
  );

  const cancelTicket = useCallback(
    async (ticketId: string): Promise<TicketActionResult> => {
      const supabase = supabaseRef.current;
      const { data, error: rpcErr } = await supabase.rpc("cancel_help_ticket", {
        p_ticket_id: ticketId,
      });
      if (rpcErr) throw rpcErr;
      const result = data as TicketActionResult;
      void fetchTickets();
      return result;
    },
    [fetchTickets],
  );

  const getMyPosition = useCallback(
    async (ticketId: string): Promise<QueuePositionResult> => {
      const supabase = supabaseRef.current;
      const { data, error: rpcErr } = await supabase.rpc(
        "get_help_queue_position",
        { p_ticket_id: ticketId },
      );
      if (rpcErr) throw rpcErr;
      return data as QueuePositionResult;
    },
    [],
  );

  return {
    tickets,
    isLoading,
    error,
    isRealtimeConnected,
    submitTicket,
    claimTicket,
    resolveTicket,
    cancelTicket,
    getMyPosition,
    refresh: fetchTickets,
  };
}
