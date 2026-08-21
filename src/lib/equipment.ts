// src/lib/equipment.ts
//
// Frontend client for the Equipment Rental System (Issue #2901).

import { supabase } from "./supabase/client";

export interface InventoryItem {
    id: string;
    name: string;
    barcode: string;
    category: string;
    condition: "good" | "damaged" | "maintenance";
    damage_notes: string | null;
    is_active: boolean;
}

export interface EquipmentReservation {
    id: string;
    item_id: string;
    club_id: string;
    reserved_by: string;
    start_date: string;
    end_date: string;
    status: "pending" | "approved" | "checked_out" | "returned" | "overdue" | "cancelled";
    checked_out_at: string | null;
    returned_at: string | null;
    notes: string | null;
}

export interface AvailabilityResult {
    available: boolean;
}

/**
 * Fetch all active inventory items.
 */
export async function fetchInventory(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("is_active", true)
        .order("name");

    if (error || !data) return [];
    return data as InventoryItem[];
}

/**
 * Fetch all reservations for a specific item.
 */
export async function fetchReservations(itemId: string): Promise<EquipmentReservation[]> {
    const { data, error } = await supabase
        .from("equipment_reservations")
        .select("*")
        .eq("item_id", itemId)
        .order("start_date", { ascending: true });

    if (error || !data) return [];
    return data as EquipmentReservation[];
}

/**
 * Check if an item is available for the given date range.
 * Calls the `check_equipment_availability` RPC.
 */
export async function checkAvailability(
    itemId: string,
    startDate: string,
    endDate: string
): Promise<boolean> {
    const { data, error } = await supabase.rpc("check_equipment_availability", {
        p_item_id: itemId,
        p_start_date: startDate,
        p_end_date: endDate,
    });

    if (error || data === null) return false;
    return Boolean(data);
}

/**
 * Create a new reservation.
 */
export async function createReservation(
    itemId: string,
    clubId: string,
    userId: string,
    startDate: string,
    endDate: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from("equipment_reservations").insert({
        item_id: itemId,
        club_id: clubId,
        reserved_by: userId,
        start_date: startDate,
        end_date: endDate,
        status: "pending",
        notes: notes ?? null,
    });

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true };
}

/**
 * Scan a barcode and check out the item for the given reservation.
 */
export async function checkOutEquipment(
    barcode: string,
    reservationId: string
): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc("check_out_equipment", {
        p_barcode: barcode,
        p_reservation_id: reservationId,
    });

    if (error || !data || data.success === false) {
        return {
            success: false,
            message: data?.error ?? error?.message ?? "Checkout failed.",
        };
    }
    return { success: true, message: data.message };
}

/**
 * Scan a barcode and check in the item.
 * Supports damage reporting.
 */
export async function checkInEquipment(
    barcode: string,
    condition: "good" | "damaged" = "good",
    damageNotes?: string
): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc("check_in_equipment", {
        p_barcode: barcode,
        p_condition: condition,
        p_damage_notes: damageNotes ?? null,
    });

    if (error || !data || data.success === false) {
        return {
            success: false,
            message: data?.error ?? error?.message ?? "Check-in failed.",
        };
    }
    return { success: true, message: data.message };
}
