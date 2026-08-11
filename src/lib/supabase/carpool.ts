/**
 * Carpooling-to-Off-Campus-Events Supabase database operations.
 * Provides typed helpers for listing carpools for an event and for the
 * driver/passenger RPCs (offer, claim, leave, cancel).
 */

import { supabase } from "./client";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database.types";

export type { Database };
export type Carpool = Tables<"carpools">;
export type CarpoolPassenger = Tables<"carpool_passengers">;

export type CarpoolDriver = {
  full_name: string | null;
  avatar_url: string | null;
};

/** A carpool enriched for the Transportation UI. */
export type CarpoolWithDetails = Carpool & {
  driver: CarpoolDriver | null;
  passenger_count: number;
  /** The current user's passenger row for this carpool, if any. */
  my_passenger_id: string | null;
};

export interface CarpoolOfferInput {
  capacity: number;
  departureTime: string;
  meetingPoint: string;
  notes?: string;
}

type RpcResult = {
  success: boolean;
  code: string;
  message: string;
};

/**
 * Fetch all active carpools for an event, joined with the driver's profile
 * and an aggregate passenger count.
 */
export async function fetchCarpoolsForEvent(
  eventId: string,
  currentUserId?: string | null,
): Promise<{ data: CarpoolWithDetails[] | null; error: PostgrestError | Error | unknown }> {
  try {
    const { data, error } = await supabase
      .from("carpools")
      .select(
        "*, driver:profiles!carpools_driver_id_fkey(full_name, avatar_url), carpool_passengers(count)",
      )
      .eq("event_id", eventId)
      .order("departure_time", { ascending: true });

    if (error) {
      console.error("Error fetching carpools:", error);
      return { data: null, error };
    }

    const rows = (data ?? []) as Array<
      Carpool & {
        driver: CarpoolDriver | CarpoolDriver[] | null;
        carpool_passengers: Array<{ count: number }>;
      }
    >;

    const myPassengerRows = await fetchMyPassengerRows(rows, currentUserId);

    const enriched: CarpoolWithDetails[] = rows.map((row) => {
      const driver = Array.isArray(row.driver) ? (row.driver[0] ?? null) : (row.driver ?? null);
      const passengerCount =
        (Array.isArray(row.carpool_passengers) ? row.carpool_passengers[0]?.count : 0) ?? 0;
      return {
        ...row,
        driver,
        passenger_count: passengerCount,
        my_passenger_id: myPassengerRows[row.id] ?? null,
      };
    });

    return { data: enriched, error: null };
  } catch (err) {
    console.error("Unexpected error in fetchCarpoolsForEvent:", err);
    return { data: null, error: err };
  }
}

async function fetchMyPassengerRows(
  carpools: Array<{ id: string }>,
  currentUserId?: string | null,
): Promise<Record<string, string>> {
  if (!currentUserId || carpools.length === 0) return {};
  try {
    const carpoolIds = carpools.map((c) => c.id);
    const { data, error } = await supabase
      .from("carpool_passengers")
      .select("id, carpool_id")
      .in("carpool_id", carpoolIds)
      .eq("passenger_id", currentUserId);
    if (error || !data) return {};
    return Object.fromEntries(data.map((row) => [row.carpool_id, row.id]));
  } catch {
    return {};
  }
}

/** Offer a ride: creates the carpool and provisions its group chat. */
export async function offerCarpool(
  eventId: string,
  input: CarpoolOfferInput,
): Promise<{ data: RpcResult | null; error: PostgrestError | Error | unknown }> {
  try {
    const { data, error } = await supabase.rpc("offer_carpool", {
      p_event_id: eventId,
      p_capacity: input.capacity,
      p_departure_time: input.departureTime,
      p_meeting_point: input.meetingPoint,
      p_notes: input.notes ?? null,
    });
    if (error) return { data: null, error };
    return { data: data as RpcResult | null, error: null };
  } catch (err) {
    console.error("Unexpected error in offerCarpool:", err);
    return { data: null, error: err };
  }
}

/** Request a seat in a specific carpool (up to capacity). */
export async function claimCarpoolSeat(
  carpoolId: string,
): Promise<{ data: RpcResult | null; error: PostgrestError | Error | unknown }> {
  try {
    const { data, error } = await supabase.rpc("claim_carpool_seat", {
      p_carpool_id: carpoolId,
    });
    if (error) return { data: null, error };
    return { data: data as RpcResult | null, error: null };
  } catch (err) {
    console.error("Unexpected error in claimCarpoolSeat:", err);
    return { data: null, error: err };
  }
}

/** Release your own seat in a carpool. */
export async function leaveCarpool(
  carpoolId: string,
): Promise<{ data: RpcResult | null; error: PostgrestError | Error | unknown }> {
  try {
    const { data, error } = await supabase.rpc("leave_carpool", {
      p_carpool_id: carpoolId,
    });
    if (error) return { data: null, error };
    return { data: data as RpcResult | null, error: null };
  } catch (err) {
    console.error("Unexpected error in leaveCarpool:", err);
    return { data: null, error: err };
  }
}

/** Cancel a carpool (driver only). Attached passengers are notified in-app. */
export async function cancelCarpool(
  carpoolId: string,
): Promise<{ data: RpcResult | null; error: PostgrestError | Error | unknown }> {
  try {
    const { data, error } = await supabase.rpc("cancel_carpool", {
      p_carpool_id: carpoolId,
    });
    if (error) return { data: null, error };
    return { data: data as RpcResult | null, error: null };
  } catch (err) {
    console.error("Unexpected error in cancelCarpool:", err);
    return { data: null, error: err };
  }
}
