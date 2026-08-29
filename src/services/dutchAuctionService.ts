// =============================================================================
// Service: DutchAuctionService
// Purpose: Handles querying and buying tickets under last-minute Dutch auctions.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface DutchAuction {
  id: string;
  event_id: string;
  ticket_tier_id: string;
  start_price_cents: number;
  min_price_cents: number;
  price_drop_interval_seconds: number;
  price_drop_amount_cents: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
}

export class DutchAuctionService {
  /**
   * Fetches the active Dutch auction for an event, if one exists.
   */
  static async getActiveAuction(eventId: string): Promise<DutchAuction | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("dutch_auctions")
        .select("*")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error fetching Dutch auction:", error.message);
        return null;
      }

      return data as DutchAuction | null;
    } catch (err) {
      console.error("Fatal error fetching Dutch auction:", err);
      return null;
    }
  }

  /**
   * Invokes the database RPC to calculate the current dynamic price.
   */
  static async getCurrentPrice(auctionId: string): Promise<number> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("get_dutch_auction_current_price", {
        p_auction_id: auctionId,
        p_now: new Date().toISOString(),
      });

      if (error) throw error;
      return typeof data === "number" ? data : 0;
    } catch (err) {
      console.error("Error fetching Dutch auction price:", err);
      return 0;
    }
  }

  /**
   * Executes a high-speed Dutch auction purchase transaction.
   */
  static async purchaseTicket(
    auctionId: string,
    userId: string,
    maxPriceCents: number
  ): Promise<{
    success: boolean;
    error?: string;
    rsvpId?: string;
    purchaseId?: string;
    pricePaidCents?: number;
    remainingCapacity?: number;
  }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("purchase_dutch_auction_ticket", {
        p_auction_id: auctionId,
        p_user_id: userId,
        p_max_price_cents: maxPriceCents,
        p_now: new Date().toISOString(),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Handle custom database RPC responses
      const res = typeof data === "string" ? JSON.parse(data) : data;
      if (res && res.success) {
        return {
          success: true,
          rsvpId: res.rsvp_id,
          purchaseId: res.purchase_id,
          pricePaidCents: res.price_paid_cents,
          remainingCapacity: res.remaining_capacity,
        };
      } else {
        return { success: false, error: res?.error || "Purchase failed." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Network execution error." };
    }
  }
}
