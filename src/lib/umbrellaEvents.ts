// src/lib/umbrellaEvents.ts
//
// Frontend client for the Umbrella Events architecture (Issue #2909).
//
// Provides typed helpers for:
//   - Fetching the umbrella schedule (parent + all child events).
//   - Purchasing a global pass.
//   - Claiming a seat at a gated child event.

import { supabase } from "./supabase/client";

/**
 * A child event under an umbrella, with attendance count + club info.
 */
export interface ChildEvent {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    event_date: string | null;
    start_date: string | null;
    end_date: string | null;
    banner_url: string | null;
    max_attendees: number | null;
    club_id: string;
    event_type: string;
    parent_event_id: string | null;
    club_name: string | null;
    club_slug: string | null;
    attending_count: number;
}

/**
 * The parent umbrella event.
 */
export interface UmbrellaEvent {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    event_date: string | null;
    start_date: string | null;
    end_date: string | null;
    banner_url: string | null;
    max_attendees: number | null;
    club_id: string;
    event_type: string;
}

/**
 * The full umbrella schedule returned by `get_umbrella_schedule`.
 */
export interface UmbrellaSchedule {
    umbrella: UmbrellaEvent;
    children: ChildEvent[];
}

/**
 * The result of purchasing a global pass.
 */
export interface GlobalPassResult {
    success: boolean;
    message: string;
    autoRsvpedCount: number;
    waitlistedCount: number;
}

/**
 * Fetch the umbrella schedule (parent + all child events with
 * attendance counts), ordered by start time.
 */
export async function fetchUmbrellaSchedule(
    umbrellaId: string
): Promise<UmbrellaSchedule | null> {
    const { data, error } = await supabase.rpc("get_umbrella_schedule", {
        p_umbrella_id: umbrellaId,
    });

    if (error || !data || data.success === false) {
        console.error("[umbrellaEvents] Failed to fetch schedule:", error);
        return null;
    }

    return {
        umbrella: data.umbrella,
        children: data.children ?? [],
    };
}

/**
 * Purchase a global pass for an umbrella event. This auto-RSVPs the
 * user to all ungated child events and claims seats at gated events
 * that have room. Full gated events place the user on the waitlist.
 */
export async function purchaseGlobalPass(
    umbrellaId: string,
    userId: string
): Promise<GlobalPassResult> {
    const { data, error } = await supabase.rpc("purchase_global_pass", {
        p_umbrella_id: umbrellaId,
        p_user_id: userId,
    });

    if (error || !data || data.success === false) {
        return {
            success: false,
            message: data?.error ?? error?.message ?? "Failed to purchase pass.",
            autoRsvpedCount: 0,
            waitlistedCount: 0,
        };
    }

    return {
        success: true,
        message: data.message ?? "Global pass purchased.",
        autoRsvpedCount: data.auto_rsvped_count ?? 0,
        waitlistedCount: data.waitlisted_count ?? 0,
    };
}
