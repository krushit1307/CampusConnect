// =============================================================================
// Hook: useItemReservations
// Issue: #3340 - Develop a 'Club Resource Booking Calendar'
// Description: Loads a club's bookable inventory items and their
// reservations, keeps them live via Supabase Realtime, and exposes
// mutations to request a booking and to approve/reject/cancel one.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  condition: string;
}

export interface ItemReservation {
  id: string;
  item_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  inventory_items: InventoryItem | null;
  profiles: { full_name: string | null } | null;
}

export function useItemReservations(clubId: string | undefined) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [reservations, setReservations] = useState<ItemReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async (id: string) => {
    const supabase = createClient();

    const { data: itemRows, error: itemsError } = await supabase
      .from("inventory_items")
      .select("id, name, category, condition")
      .eq("owner_club_id", id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (itemsError) {
      console.error("[useItemReservations] Failed to load items:", itemsError.message);
      setIsLoading(false);
      return;
    }

    setItems(itemRows || []);

    const itemIds = (itemRows || []).map((i) => i.id);
    if (itemIds.length === 0) {
      setReservations([]);
      setIsLoading(false);
      return;
    }

    const { data: reservationRows, error: reservationsError } = await supabase
      .from("item_reservations")
      .select(
        "id, item_id, user_id, start_time, end_time, status, created_at, inventory_items (id, name, category, condition), profiles (full_name)",
      )
      .in("item_id", itemIds)
      .in("status", ["pending", "approved"])
      .order("start_time", { ascending: true });

    if (reservationsError) {
      console.error(
        "[useItemReservations] Failed to load reservations:",
        reservationsError.message,
      );
      setIsLoading(false);
      return;
    }

    setReservations((reservationRows as unknown as ItemReservation[]) || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!clubId) return;

    const supabase = createClient();
    let mounted = true;
    let channel: RealtimeChannel | null = null;

    fetchAll(clubId).then(() => {
      if (!mounted) return;
      channel = supabase
        .channel(`item-reservations-${clubId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "item_reservations" },
          () => {
            if (mounted) fetchAll(clubId);
          },
        )
        .subscribe();
    });

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [clubId, fetchAll]);

  const requestReservation = useCallback(
    async (itemId: string, userId: string, startTime: Date, endTime: Date) => {
      const supabase = createClient();

      const { data: isAvailable, error: availabilityError } = await supabase.rpc(
        "check_item_availability",
        {
          p_item_id: itemId,
          p_start_time: startTime.toISOString(),
          p_end_time: endTime.toISOString(),
        },
      );

      if (availabilityError) throw availabilityError;
      if (!isAvailable) throw new Error("That item is already booked during this time.");

      const { error } = await supabase.from("item_reservations").insert({
        item_id: itemId,
        user_id: userId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      });

      if (error) throw error;
    },
    [],
  );

  const updateReservationStatus = useCallback(
    async (reservationId: string, status: "approved" | "rejected" | "cancelled") => {
      const supabase = createClient();
      const { error } = await supabase
        .from("item_reservations")
        .update({ status })
        .eq("id", reservationId);

      if (error) throw error;
    },
    [],
  );

  return {
    items,
    reservations,
    isLoading,
    requestReservation,
    updateReservationStatus,
  };
}