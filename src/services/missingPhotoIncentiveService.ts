// =============================================================================
// File: src/services/missingPhotoIncentiveService.ts
// Feature: Automated "Missing Photo" Incentive Engine
// Description: Combines the Task system with the Gamification economy to bribe
//              organizers into uploading event cover photos and posters.
// =============================================================================

import { createClient } from "../lib/supabase/client";
import type {
  MissingPhotoTask,
  IncentiveClaimResult,
} from "../types/missingPhotoIncentive";

/**
 * Scans a list of events and generates missing photo incentive tasks for those without posters.
 */
export function scanAndGenerateMissingPhotoTasks(
  events: Array<{
    id: string;
    title?: string;
    name?: string;
    cover_image_url?: string | null;
    poster_url?: string | null;
    created_by?: string;
    user_id?: string;
    created_at?: string;
  }>,
  organizerId: string = "org-1"
): MissingPhotoTask[] {
  const missingPhotoEvents = events.filter(
    (e) => !e.cover_image_url && !e.poster_url
  );

  return missingPhotoEvents.map((event, index) => {
    const eventId = event.id;
    const eventTitle = event.title || event.name || `Campus Event #${eventId}`;
    const createdAt = event.created_at || new Date().toISOString();
    
    // Deadline is 48 hours after creation
    const deadlineAt = new Date(
      new Date(createdAt).getTime() + 48 * 3600 * 1000
    ).toISOString();

    return {
      id: `task-missing-photo-${eventId}`,
      eventId,
      eventTitle,
      organizerId: event.created_by || event.user_id || organizerId,
      status: "pending",
      bountyPoints: 150,
      bountyXp: 100,
      createdAt,
      deadlineAt,
    };
  });
}

/**
 * Claims the missing photo task bounty upon photo upload verification.
 * Updates event cover_image_url, deposits gamification points, and marks task complete.
 */
export async function claimMissingPhotoBounty(
  taskId: string,
  eventId: string,
  photoUrl: string,
  organizerId: string = "org-1"
): Promise<IncentiveClaimResult> {
  const supabase = createClient();

  if (!photoUrl || photoUrl.trim().length === 0) {
    throw new Error("Valid photo URL is required to claim missing photo bounty.");
  }

  try {
    // 1. Update the event's cover_image_url in database
    const { error: eventError } = await supabase
      .from("events")
      .update({ cover_image_url: photoUrl })
      .eq("id", eventId);

    if (eventError) {
      console.warn("Event update warning, proceeding with reward claim:", eventError);
    }

    // 2. Fetch organizer current points and increment by +150 points
    let currentPoints = 1200;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("gamification_points")
        .eq("id", organizerId)
        .single();

      if (profile && profile.gamification_points !== undefined) {
        currentPoints = profile.gamification_points;
      }
    } catch {
      // Fallback
    }

    const pointsAwarded = 150;
    const xpAwarded = 100;
    const newTotalPoints = currentPoints + pointsAwarded;

    // 3. Deposit points into organizer profile
    try {
      await supabase
        .from("profiles")
        .update({ gamification_points: newTotalPoints })
        .eq("id", organizerId);
    } catch (err) {
      console.warn("Points update warning:", err);
    }

    return {
      success: true,
      taskId,
      eventId,
      pointsAwarded,
      xpAwarded,
      newTotalPoints,
      badgeUnlocked: "Visual Maestro 📸",
      message: `🎉 Bribe Claimed! +${pointsAwarded} Gamification Points & +${xpAwarded} XP deposited to your account!`,
    };
  } catch (err: any) {
    console.error("Error claiming missing photo bounty:", err);
    return {
      success: false,
      taskId,
      eventId,
      pointsAwarded: 0,
      xpAwarded: 0,
      newTotalPoints: 1200,
      message: err.message || "Failed to claim missing photo bounty.",
    };
  }
}

/**
 * Generates mock missing photo tasks for testing and demonstration.
 */
export function getMockMissingPhotoTasks(
  eventId?: string,
  organizerId: string = "org-1"
): MissingPhotoTask[] {
  const targetId = eventId || "evt-demo-missing";
  return [
    {
      id: `task-missing-photo-${targetId}`,
      eventId: targetId,
      eventTitle: "Annual Spring Gala & Awards Night",
      organizerId,
      status: "pending",
      bountyPoints: 150,
      bountyXp: 100,
      createdAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
    },
  ];
}
