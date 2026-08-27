// =============================================================================
// Service: DJ Request System
// Issue: #3462 - Build an 'Interactive Live DJ Request System' & #4490 DJ Mode
// Description: Manages song requests, upvoting architecture (Issue #3272),
// swipe-to-dismiss actions for DJ booth iPad management, and Admin overrides.
// =============================================================================

import { createClient } from "../lib/supabase/client";
import type { EventSongRequest } from "../types/database";

/**
 * Submits a new song request for an event.
 */
export async function submitSongRequest(
  eventId: string,
  userId: string,
  songTitle: string,
  artist: string,
  albumArtUrl?: string,
): Promise<{ success: boolean; data?: EventSongRequest; error?: string }> {
  if (!eventId || !userId || !songTitle || !artist) {
    return { success: false, error: "Missing required request details." };
  }

  const supabase = createClient();

  try {
    // 1. Insert into event_song_requests table
    const { data: request, error: insertError } = await supabase
      .from("event_song_requests")
      .insert({
        event_id: eventId,
        user_id: userId,
        song_title: songTitle.trim(),
        artist: artist.trim(),
        album_art_url: albumArtUrl || null,
        upvotes: 1,
        played: false,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 2. Insert creator upvote record
    await supabase
      .from("event_song_request_upvotes")
      .insert({
        request_id: request.id,
        user_id: userId,
      })
      .catch(() => {});

    return { success: true, data: request as EventSongRequest };
  } catch (err: any) {
    console.error("[djRequestService] Submit request error:", err);
    return { success: false, error: err.message || "Failed to submit song request." };
  }
}

/**
 * Upvotes (or toggles upvote for) an existing song request (Issue #3272 architecture).
 */
export async function upvoteSongRequest(
  requestId: string,
  userId: string,
): Promise<{ success: boolean; newUpvotes?: number; hasUpvoted?: boolean; error?: string }> {
  if (!requestId || !userId) {
    return { success: false, error: "Missing requestId or userId." };
  }

  const supabase = createClient();

  try {
    // 1. Check if user has already upvoted this request
    const { data: existingVote } = await supabase
      .from("event_song_request_upvotes")
      .select("request_id")
      .eq("request_id", requestId)
      .eq("user_id", userId)
      .maybeSingle();

    // Fetch current request record
    const { data: currentReq, error: reqErr } = await supabase
      .from("event_song_requests")
      .select("upvotes")
      .eq("id", requestId)
      .single();

    if (reqErr || !currentReq) {
      throw new Error("Song request not found.");
    }

    if (existingVote) {
      // Remove upvote (toggle off)
      await supabase
        .from("event_song_request_upvotes")
        .delete()
        .eq("request_id", requestId)
        .eq("user_id", userId);

      const newCount = Math.max(1, currentReq.upvotes - 1);
      await supabase.from("event_song_requests").update({ upvotes: newCount }).eq("id", requestId);

      return { success: true, newUpvotes: newCount, hasUpvoted: false };
    } else {
      // Add upvote
      await supabase.from("event_song_request_upvotes").insert({
        request_id: requestId,
        user_id: userId,
      });

      const newCount = currentReq.upvotes + 1;
      await supabase.from("event_song_requests").update({ upvotes: newCount }).eq("id", requestId);

      return { success: true, newUpvotes: newCount, hasUpvoted: true };
    }
  } catch (err: any) {
    console.error("[djRequestService] Upvote error:", err);
    return { success: false, error: err.message || "Failed to upvote request." };
  }
}

/**
 * Swipe-to-dismiss gesture action for the DJ booth to mark a song as played/dismissed.
 */
export async function dismissSongRequest(
  requestId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!requestId) return { success: false, error: "Missing requestId." };

  const supabase = createClient();

  try {
    const { error } = await supabase
      .from("event_song_requests")
      .update({ played: true })
      .eq("id", requestId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("[djRequestService] Dismiss error:", err);
    return { success: false, error: err.message || "Failed to dismiss request." };
  }
}

/**
 * Overrides the crowd queue, manually setting the order based on admin drag-and-drop.
 */
export async function overrideAdminQueue(
  items: Array<{ id: string; overridden_by_admin: boolean; admin_sort_order?: number }>,
): Promise<{ success: boolean }> {
  const supabase = createClient();

  const promises = items.map((item) =>
    supabase
      .from("event_song_requests")
      .update({
        overridden_by_admin: item.overridden_by_admin,
        admin_sort_order: item.admin_sort_order,
      })
      .eq("id", item.id),
  );

  const results = await Promise.all(promises);
  if (results.some((res) => res.error)) {
    throw new Error("Failed to sync queue.");
  }
  return { success: true };
}
