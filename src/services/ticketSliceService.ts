// =============================================================================
// Service: TicketSliceService
// Purpose: Client wiring for fractional ticket slices (#5375):
//          - listing owned slices on the Dutch-auction secondary market
//          - browsing active slice auctions with a live price ticker
//          - buying slices at the current Dutch price
//          - burning a slice QR at the door (bouncer)
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface TicketSlice {
  id: string;
  rsvp_id: string;
  event_id: string;
  slice_start: string;
  slice_end: string;
  slice_token: string;
  owner_user_id: string;
  status: "available" | "listed" | "sold" | "burned";
  listed_price_cents: number | null;
  sold_price_cents: number | null;
  burned_at: string | null;
  created_at: string;
}

export interface SliceAuction {
  id: string;
  slice_id: string;
  event_id: string;
  seller_user_id: string;
  start_price_cents: number;
  min_price_cents: number;
  price_drop_interval_seconds: number;
  price_drop_amount_cents: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  slice_start?: string;
  slice_end?: string;
}

export interface SliceMarketListing extends SliceAuction {
  slice: TicketSlice;
}

export interface UserSliceView {
  slice_id: string;
  event_id: string;
  event_title: string;
  slice_start: string;
  slice_end: string;
  status: string;
  slice_token: string;
  sold_price_cents: number | null;
}

export class TicketSliceService {
  /** Splits an owned ticket into N time slices. */
  static async fractionalizeTicket(
    rsvpId: string,
    userId: string,
    sliceCount = 2,
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("fractionalize_ticket", {
      p_rsvp_id: rsvpId,
      p_user_id: userId,
      p_slice_count: sliceCount,
    });
    if (error) return { success: false, error: error.message };
    const res = data as { success: boolean; error?: string };
    return { success: res.success, error: res.error };
  }

  /** Lists an owned slice on the Dutch-auction secondary market. */
  static async listSliceAuction(params: {
    sliceId: string;
    sellerId: string;
    startPriceCents: number;
    minPriceCents: number;
    dropIntervalSeconds?: number;
    dropAmountCents?: number;
  }): Promise<{ success: boolean; auctionId?: string; error?: string }> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("list_ticket_slice_auction", {
      p_slice_id: params.sliceId,
      p_seller_id: params.sellerId,
      p_start_price_cents: params.startPriceCents,
      p_min_price_cents: params.minPriceCents,
      p_price_drop_interval_seconds: params.dropIntervalSeconds ?? 60,
      p_price_drop_amount_cents: params.dropAmountCents ?? 100,
    });
    if (error) return { success: false, error: error.message };
    const res = data as { success: boolean; auction_id?: string; error?: string };
    return { success: res.success, auctionId: res.auction_id, error: res.error };
  }

  /** Current Dutch price for a slice auction. */
  static async getCurrentPrice(auctionId: string): Promise<number | null> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_slice_auction_current_price", {
      p_auction_id: auctionId,
      p_now: new Date().toISOString(),
    });
    if (error) return null;
    return typeof data === "number" ? data : null;
  }

  /** Buys a slice at the current Dutch price, honoring the buyer's max price. */
  static async purchaseSlice(
    auctionId: string,
    buyerId: string,
    maxPriceCents: number,
  ): Promise<{ success: boolean; pricePaidCents?: number; error?: string }> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("purchase_slice_auction", {
      p_auction_id: auctionId,
      p_buyer_id: buyerId,
      p_max_price_cents: maxPriceCents,
    });
    if (error) return { success: false, error: error.message };
    const res = data as { success: boolean; price_paid_cents?: number; error?: string };
    return { success: res.success, pricePaidCents: res.price_paid_cents, error: res.error };
  }

  /** Active slice auctions for an event's secondary market. */
  static async getActiveSliceAuctions(eventId: string): Promise<SliceMarketListing[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ticket_slice_auctions")
      .select("*, slice:ticket_slices(*)")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) return [];
    return (data ?? []) as SliceMarketListing[];
  }

  /** The current user's non-burned slices. */
  static async getMySlices(userId: string): Promise<UserSliceView[]> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_user_ticket_slices", {
      p_user_id: userId,
      p_now: new Date().toISOString(),
    });
    if (error) return [];
    return (data ?? []) as UserSliceView[];
  }

  /** Burns a slice at the door (bouncer). */
  static async burnSlice(
    sliceToken: string,
    scannerUserId?: string,
  ): Promise<{ success: boolean; error?: string; sliceId?: string }> {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("verify-slice-ticket", {
      body: { sliceToken, scannerUserId },
    });

    if (error) {
      const message = (error.context as { message?: string })?.message ?? "Failed to verify slice";
      return { success: false, error: message };
    }
    const res = data as { success: boolean; error?: string; slice_id?: string };
    return { success: res.success, error: res.error, sliceId: res.slice_id };
  }

  /** Client-side mirror of the Dutch price clock (for the 1s ticker). */
  static calculateLivePrice(auction: SliceAuction, now = new Date()): number {
    const start = new Date(auction.starts_at).getTime();
    const end = new Date(auction.ends_at).getTime();
    const nowMs = now.getTime();

    if (nowMs < start) return auction.start_price_cents;
    if (nowMs >= end) return auction.min_price_cents;

    const elapsed = Math.floor((nowMs - start) / 1000);
    const drops = Math.floor(elapsed / auction.price_drop_interval_seconds);
    return Math.max(
      auction.min_price_cents,
      auction.start_price_cents - drops * auction.price_drop_amount_cents,
    );
  }
}
