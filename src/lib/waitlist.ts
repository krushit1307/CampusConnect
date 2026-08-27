// src/lib/waitlist.ts
import { supabase } from "./supabase/client";

/**
 * Outcome of a join-or-waitlist call.
 */
export type JoinResult =
  | { success: true; status: "attending"; message?: string }
  | { success: true; status: "waitlisted"; position: number }
  | { success: false; error: string };

/**
 * Outcome of a cancel-RSVP call.
 */
export type CancelResult =
  { success: true; wasAttending: boolean; message: string } | { success: false; error: string };

/**
 * The RSVP state for an event, returned by `get_event_rsvp_state`.
 */
export interface EventRsvpState {
  max_attendees: number | null;
  is_resume_required: boolean;
  attending_count: number;
  waitlist_count: number;
  is_full: boolean;
  user_status: "attending" | "waitlisted" | "cancelled" | null;
  user_waitlist_position: number | null;
}

/**
 * Join an event or its waitlist atomically via the
 * `join_event_or_waitlist` Postgres RPC.
 *
 * The RPC locks the event row with SELECT FOR UPDATE and decides
 * whether to insert an `attending` or `waitlisted` row based on
 * the current attending count vs. `max_attendees`. This is the
 * race-condition-safe path described in issue #2693.
 */
export async function joinEventOrWaitlist(
  eventId: string,
  userId: string,
  isAnonymous: boolean = false,
  resumePath?: string,
  referredBy?: string | null,
): Promise<JoinResult> {
  const { data, error } = await supabase.rpc("join_event_or_waitlist", {
    p_event_id: eventId,
    p_user_id: userId,
    p_is_anonymous: isAnonymous,
    p_resume_path: resumePath ?? null,
    p_referred_by: referredBy ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: "No response from server." };
  }
  if (data.success === false) {
    return { success: false, error: data.error ?? "Unknown error" };
  }
  if (data.status === "attending") {
    return { success: true, status: "attending", message: data.message };
  }
  if (data.status === "waitlisted") {
    return {
      success: true,
      status: "waitlisted",
      position: data.position ?? 0,
    };
  }
  return { success: false, error: `Unexpected status: ${data.status}` };
}

/**
 * Cancel the calling user's RSVP (attending or waitlisted) via the
 * `cancel_event_rsvp` Postgres RPC. The RPC marks the row as
 * `cancelled` (preserving the audit trail) and triggers automatic
 * promotion of the next waitlisted user.
 */
export async function cancelEventRsvp(eventId: string, userId: string): Promise<CancelResult> {
  const { data, error } = await supabase.rpc("cancel_event_rsvp", {
    p_event_id: eventId,
    p_user_id: userId,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: "No response from server." };
  }
  if (data.success === false) {
    return { success: false, error: data.error ?? "Unknown error" };
  }
  return {
    success: true,
    wasAttending: Boolean(data.was_attending),
    message: data.message ?? "RSVP cancelled.",
  };
}

/**
 * Fetch the RSVP state for an event (attending count, waitlist count,
 * is_full, and the calling user's status/position). Used by the
 * frontend to render the "Event Full - N on Waitlist" banner and
 * switch the RSVP button into the Join Waitlist state.
 */
export async function getEventRsvpState(
  eventId: string,
  userId?: string,
): Promise<EventRsvpState | null> {
  const { data, error } = await supabase.rpc("get_event_rsvp_state", {
    p_event_id: eventId,
    p_user_id: userId ?? null,
  });

  if (error || !data) {
    return null;
  }
  return {
    max_attendees: data.max_attendees,
    attending_count: data.attending_count,
    waitlist_count: data.waitlist_count,
    is_full: data.is_full,
    user_status: data.user_status,
    user_waitlist_position: data.user_waitlist_position,
  };
}
