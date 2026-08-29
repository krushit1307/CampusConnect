// @ts-nocheck
// =============================================================================
// Service: TicketTradeService
// Issue: #3234 - Peer-to-Peer Ticket Swapping Marketplace
// Description: Provides API functions for listing, proposing, accepting, and
// cancelling P2P ticket swaps via Supabase RPCs.
// =============================================================================

import { createClient } from "../lib/supabase/client";

export interface TicketTradeListing {
  id: string;
  initiator_rsvp_id: string;
  initiator_id: string;
  requested_event_id: string;
  responder_rsvp_id?: string | null;
  responder_id?: string | null;
  status: "open" | "completed" | "cancelled" | "rejected";
  created_at: string;
  updated_at: string;
  initiator_profile?: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
  offered_event?: {
    id: string;
    title: string;
    ticket_price: number;
    banner_url?: string;
    event_date?: string;
  };
  requested_event?: {
    id: string;
    title: string;
    ticket_price: number;
    banner_url?: string;
    event_date?: string;
  };
}

export interface TradeRPCResult {
  success: boolean;
  trade_id?: string;
  message?: string;
  error?: string;
}

/**
 * Fetches active open trade offers from the Ticket Exchange marketplace.
 */
export async function fetchOpenTicketTrades(
  requestedEventId?: string,
): Promise<TicketTradeListing[]> {
  const supabase = createClient();
  let query = supabase
    .from("ticket_trades")
    .select(
      `
      *,
      initiator_profile:initiator_id (first_name, last_name, avatar_url),
      requested_event:requested_event_id (id, title, ticket_price, banner_url, event_date),
      initiator_rsvp:initiator_rsvp_id (
        id,
        event_id,
        events:event_id (id, title, ticket_price, banner_url, event_date)
      )
    `,
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (requestedEventId) {
    query = query.eq("requested_event_id", requestedEventId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching open ticket trades:", error);
    return [];
  }

  return (data || []).map((item: any) => ({
    ...item,
    offered_event: item.initiator_rsvp?.events,
  }));
}

/**
 * Proposes a new ticket trade listing.
 */
export async function proposeTicketTrade(
  initiatorRsvpId: string,
  requestedEventId: string,
): Promise<TradeRPCResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("propose_ticket_trade", {
    p_initiator_rsvp_id: initiatorRsvpId,
    p_requested_event_id: requestedEventId,
  });

  if (error) {
    console.error("Error proposing ticket trade:", error);
    return { success: false, error: error.message };
  }

  return data as TradeRPCResult;
}

/**
 * Accepts and executes an open ticket trade offer atomically.
 */
export async function acceptTicketTrade(
  tradeId: string,
  responderRsvpId: string,
): Promise<TradeRPCResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("accept_ticket_trade", {
    p_trade_id: tradeId,
    p_responder_rsvp_id: responderRsvpId,
  });

  if (error) {
    console.error("Error accepting ticket trade:", error);
    return { success: false, error: error.message };
  }

  return data as TradeRPCResult;
}

/**
 * Cancels an open ticket trade offer.
 */
export async function cancelTicketTrade(tradeId: string): Promise<TradeRPCResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("cancel_ticket_trade", {
    p_trade_id: tradeId,
  });

  if (error) {
    console.error("Error cancelling ticket trade:", error);
    return { success: false, error: error.message };
  }

  return data as TradeRPCResult;
}
