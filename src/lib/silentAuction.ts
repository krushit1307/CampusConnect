import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";

export interface AuctionItem {
  id: string;
  event_id: string;
  title: string;
  description?: string;
  starting_bid: number;
  current_highest_bid: number;
  bid_increment_cents: number;
  highest_bidder_id?: string;
  end_time: string;
  is_closed: boolean;
  created_at: string;
}

export interface AuctionBidResult {
  success: boolean;
  message: string;
  newHighestBid: number;
  newEndTime?: string;
  extendedByAntiSniping: boolean;
}

export const ANTI_SNIPING_THRESHOLD_MS = 120000; // Final 2 minutes (120,000ms)
export const ANTI_SNIPING_EXTENSION_MS = 300000; // 5-minute extension (300,000ms)

export interface AuctionItemUpdate {
  item_id: string;
  event_id: string;
  current_highest_bid: number;
  end_time: string;
  is_closed: boolean;
}

export interface AuctionWinner {
  id: string;
  item_id: string;
  winning_bid: number;
  stripe_checkout_url: string | null;
  payment_status: string;
}

export function formatAuctionCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

/**
 * Senior Bid Validation Engine: Validates proposed bid against current highest and starting bids.
 */
export function validateBidAmount(
  proposedBid: number,
  currentHighestBid: number,
  startingBid: number,
): { valid: boolean; error?: string } {
  if (typeof proposedBid !== "number" || isNaN(proposedBid) || proposedBid <= 0) {
    return { valid: false, error: "Please enter a valid bid amount." };
  }

  if (proposedBid < startingBid) {
    return { valid: false, error: `Bid must meet or exceed starting bid ($${startingBid}).` };
  }

  if (proposedBid <= currentHighestBid) {
    return {
      valid: false,
      error: `Bid must be higher than current highest bid ($${currentHighestBid}).`,
    };
  }

  return { valid: true };
}

/**
 * Anti-Sniping Timer Evaluation: Evaluates if a bid submitted in the final 2 minutes
 * automatically extends the item's auction end time by 5 minutes.
 */
export function calculateAntiSnipingExtension(
  endTimeIso: string,
  bidTime: Date = new Date(),
  thresholdMs = ANTI_SNIPING_THRESHOLD_MS,
  extensionMs = ANTI_SNIPING_EXTENSION_MS,
): { shouldExtend: boolean; newEndTime?: Date } {
  const endMs = new Date(endTimeIso).getTime();
  const bidMs = bidTime.getTime();

  if (endMs - bidMs <= thresholdMs && bidMs < endMs) {
    return {
      shouldExtend: true,
      newEndTime: new Date(bidMs + extensionMs),
    };
  }

  return { shouldExtend: false };
}

/** Fetches item state without exposing highest_bidder_id to the attendee UI. */
export async function fetchEventAuctionItems(
  supabase: SupabaseClient,
  eventId: string,
): Promise<AuctionItem[]> {
  const { data, error } = await supabase
    .from("auction_item_public_state")
    .select(
      "id, event_id, title, description, starting_bid, current_highest_bid, bid_increment_cents, end_time, is_closed, created_at",
    )
    .eq("event_id", eventId)
    .order("end_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AuctionItem[];
}

export async function fetchUserAuctionWinners(
  supabase: SupabaseClient,
  userId: string,
  itemIds: string[],
): Promise<AuctionWinner[]> {
  if (itemIds.length === 0) return [];

  const { data, error } = await supabase
    .from("auction_winners")
    .select("id, item_id, winning_bid, stripe_checkout_url, payment_status")
    .eq("winner_user_id", userId)
    .in("item_id", itemIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as AuctionWinner[];
}

/**
 * Places a real-time bid on a silent auction item via Supabase RPC.
 * Enforces PostgreSQL FOR UPDATE row locking and anti-sniping protection.
 */
export async function placeSilentAuctionBid(
  itemId: string,
  userId: string,
  bidAmount: number,
): Promise<AuctionBidResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("place_silent_auction_bid", {
    p_item_id: itemId,
    p_user_id: userId,
    p_bid_amount: bidAmount,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
      newHighestBid: 0,
      extendedByAntiSniping: false,
    };
  }

  const res = data?.[0];
  return {
    success: res?.success ?? false,
    message: res?.message ?? "Bid completed.",
    newHighestBid: res?.new_highest_bid ?? 0,
    newEndTime: res?.new_end_time ?? undefined,
    extendedByAntiSniping: res?.extended_by_anti_sniping ?? false,
  };
}

/**
 * Formats countdown time remaining string for live auction cards.
 */
export function formatAuctionTimeRemaining(
  endTimeIso: string,
  now: Date = new Date(),
): { isClosed: boolean; label: string } {
  const endMs = new Date(endTimeIso).getTime();
  const nowMs = now.getTime();
  const remainingMs = endMs - nowMs;

  if (remainingMs <= 0) {
    return { isClosed: true, label: "Auction Closed" };
  }

  const totalSecs = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSecs / 60);
  const seconds = totalSecs % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMins = minutes % 60;
    return { isClosed: false, label: `${hours}h ${remMins}m remaining` };
  }

  return { isClosed: false, label: `${minutes}m ${seconds}s remaining` };
}
