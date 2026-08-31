/**
 * Waitlist Utility Functions
 *
 * Pure utility functions for the Event RSVP Waitlist system.
 * Handles position calculations, time formatting, and validation.
 */

import type {
  WaitlistConfig,
  WaitlistEntry,
  WaitlistNotificationPayload,
  WaitlistPromotionResult,
  WaitlistQueueItem,
  WaitlistStats,
  WaitlistStatus,
} from "@/types/waitlist";
import { MAX_WAITLIST_MESSAGE_LENGTH, NOTIFICATION_POSITIONS } from "@/types/waitlist";

/**
 * Calculates the next available position for a waitlist entry.
 * @param entries - Existing waitlist entries sorted by position
 * @returns The next available position number
 */
export function getNextWaitlistPosition(entries: WaitlistEntry[]): number {
  if (entries.length === 0) return 1;
  const maxPosition = Math.max(...entries.map((e) => e.position));
  return maxPosition + 1;
}

/**
 * Calculates the user's waitlist position given their entry and all entries.
 * @param userEntry - The user's waitlist entry
 * @param allEntries - All active waitlist entries for the event
 * @returns The user's 1-indexed position
 */
export function getUserWaitlistPosition(
  userEntry: WaitlistEntry,
  allEntries: WaitlistEntry[],
): number {
  const activeEntries = allEntries
    .filter((e) => e.status === "waiting" || e.status === "promoted")
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at));

  const index = activeEntries.findIndex((e) => e.id === userEntry.id);
  return index >= 0 ? index + 1 : -1;
}

/**
 * Checks if an event is at capacity based on RSVPs and max attendees.
 * @param currentRsvps - Current number of RSVPs
 * @param maxAttendees - Maximum allowed attendees
 * @returns Whether the event is at capacity
 */
export function isEventAtCapacity(currentRsvps: number, maxAttendees: number | null): boolean {
  if (maxAttendees === null || maxAttendees <= 0) return false;
  return currentRsvps >= maxAttendees;
}

/**
 * Checks if the waitlist is full for an event.
 * @param currentWaitlistSize - Current number of users on the waitlist
 * @param config - Waitlist configuration
 * @returns Whether the waitlist is full
 */
export function isWaitlistFull(currentWaitlistSize: number, config: WaitlistConfig): boolean {
  return currentWaitlistSize >= config.max_waitlist_size;
}

/**
 * Formats a waitlist position for display.
 * @param position - The position number
 * @returns Formatted position string (e.g., "1st", "2nd", "3rd")
 */
export function formatWaitlistPosition(position: number): string {
  if (position <= 0) return "";

  const suffixes = ["th", "st", "nd", "rd"];
  const value = position % 100;

  if (value >= 11 && value <= 13) {
    return `${position}th`;
  }

  const suffix = suffixes[position % 10] || suffixes[0];
  return `${position}${suffix}`;
}

/**
 * Calculates the estimated wait time based on historical data.
 * @param entries - Existing waitlist entries
 * @param position - The user's position
 * @returns Estimated wait time in minutes, or null if insufficient data
 */
export function estimateWaitTime(
  entries: WaitlistEntry[],
  position: number,
): number | null {
  const promotedEntries = entries.filter(
    (e) => e.status === "promoted" && e.promoted_at && e.joined_at,
  );

  if (promotedEntries.length < 2) return null;

  const waitTimes = promotedEntries.map((e) => {
    const joined = new Date(e.joined_at).getTime();
    const promoted = new Date(e.promoted_at!).getTime();
    return (promoted - joined) / (1000 * 60); // minutes
  });

  const avgWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
  return Math.round(avgWaitTime * position);
}

/**
 * Calculates waitlist statistics for an event.
 * @param entries - All waitlist entries for the event
 * @returns Aggregated statistics
 */
export function calculateWaitlistStats(entries: WaitlistEntry[]): WaitlistStats {
  const waiting = entries.filter((e) => e.status === "waiting");
  const promoted = entries.filter((e) => e.status === "promoted");
  const expired = entries.filter((e) => e.status === "expired");
  const cancelled = entries.filter((e) => e.status === "cancelled");

  const promotedWithTimes = promoted.filter(
    (e) => e.promoted_at && e.joined_at,
  );

  let averageWaitMinutes = 0;
  let maxWaitMinutes = 0;

  if (promotedWithTimes.length > 0) {
    const waitTimes = promotedWithTimes.map((e) => {
      const joined = new Date(e.joined_at).getTime();
      const promoted = new Date(e.promoted_at!).getTime();
      return (promoted - joined) / (1000 * 60);
    });
    averageWaitMinutes = Math.round(
      waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length,
    );
    maxWaitMinutes = Math.round(Math.max(...waitTimes));
  }

  return {
    total_waiting: waiting.length,
    total_promoted: promoted.length,
    total_expired: expired.length,
    total_cancelled: cancelled.length,
    average_wait_minutes: averageWaitMinutes,
    max_wait_minutes: maxWaitMinutes,
  };
}

/**
 * Determines if a user should receive a notification based on their position.
 * @param position - Current waitlist position
 * @param previousPosition - Previous waitlist position (if any)
 * @returns Whether to send a notification
 */
export function shouldNotifyPositionChange(
  position: number,
  previousPosition: number | null,
): boolean {
  if (previousPosition === null) return true; // First time notification
  if (position === previousPosition) return false; // No change
  if (NOTIFICATION_POSITIONS.includes(position)) return true; // Reached a milestone
  // Notify when moving up by 5+ positions
  return previousPosition - position >= 5;
}

/**
 * Creates a waitlist notification payload.
 * @param type - Notification type
 * @param userId - Target user ID
 * @param eventId - Event ID
 * @param eventTitle - Event title
 * @param position - Current position
 * @param previousPosition - Previous position
 * @param promotionDeadline - Promotion deadline (for promoted notifications)
 * @returns Notification payload
 */
export function createWaitlistNotification(
  type: WaitlistNotificationPayload["type"],
  userId: string,
  eventId: string,
  eventTitle: string,
  position?: number,
  previousPosition?: number,
  promotionDeadline?: Date,
): WaitlistNotificationPayload {
  const payload: WaitlistNotificationPayload = {
    type,
    user_id: userId,
    event_id: eventId,
    event_title: eventTitle,
  };

  if (position !== undefined) payload.position = position;
  if (previousPosition !== undefined) payload.previous_position = previousPosition;
  if (promotionDeadline) {
    payload.promotion_deadline = promotionDeadline.toISOString();
  }

  return payload;
}

/**
 * Validates a waitlist entry creation request.
 * @param eventId - Event ID
 * @param userId - User ID
 * @param message - Optional message
 * @returns Validation error message or null if valid
 */
export function validateWaitlistEntry(
  eventId: string,
  userId: string,
  message?: string,
): string | null {
  if (!eventId || typeof eventId !== "string") {
    return "Invalid event ID";
  }

  if (!userId || typeof userId !== "string") {
    return "Invalid user ID";
  }

  if (message && message.length > MAX_WAITLIST_MESSAGE_LENGTH) {
    return `Message must be ${MAX_WAITLIST_MESSAGE_LENGTH} characters or less`;
  }

  return null;
}

/**
 * Formats the time a user has been waiting.
 * @param joinedAt - ISO timestamp when the user joined
 * @returns Human-readable duration string
 */
export function formatWaitDuration(joinedAt: string): string {
  const joined = new Date(joinedAt).getTime();
  const now = Date.now();
  const diffMs = now - joined;

  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return "just now";
}

/**
 * Calculates the expiration time for a promotion.
 * @param promotedAt - When the user was promoted
 * @param windowMinutes - Promotion window in minutes
 * @returns Expiration timestamp
 */
export function calculatePromotionExpiration(
  promotedAt: Date,
  windowMinutes: number,
): Date {
  return new Date(promotedAt.getTime() + windowMinutes * 60 * 1000);
}

/**
 * Checks if a promotion has expired.
 * @param expiresAt - Expiration timestamp
 * @returns Whether the promotion has expired
 */
export function isPromotionExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

/**
 * Sorts waitlist entries by position.
 * @param entries - Entries to sort
 * @param direction - Sort direction
 * @returns Sorted entries
 */
export function sortByPosition(
  entries: WaitlistEntry[],
  direction: "asc" | "desc" = "asc",
): WaitlistEntry[] {
  return [...entries].sort((a, b) => {
    const diff = a.position - b.position;
    return direction === "asc" ? diff : -diff;
  });
}

/**
 * Sorts waitlist entries by join time.
 * @param entries - Entries to sort
 * @param direction - Sort direction
 * @returns Sorted entries
 */
export function sortByJoinTime(
  entries: WaitlistEntry[],
  direction: "asc" | "desc" = "asc",
): WaitlistEntry[] {
  return [...entries].sort((a, b) => {
    const diff = new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    return direction === "asc" ? diff : -diff;
  });
}

/**
 * Filters active waitlist entries (waiting or promoted).
 * @param entries - All entries
 * @returns Only active entries
 */
export function getActiveEntries(entries: WaitlistEntry[]): WaitlistEntry[] {
  return entries.filter((e) => e.status === "waiting" || e.status === "promoted");
}

/**
 * Builds a waitlist queue item from an entry.
 * @param entry - Waitlist entry
 * @param userName - User's display name
 * @param userEmail - User's email
 * @returns Queue item for display
 */
export function buildQueueItem(
  entry: WaitlistEntry,
  userName: string,
  userEmail: string,
): WaitlistQueueItem {
  const joinedSecondsAgo = Math.floor(
    (Date.now() - new Date(entry.joined_at).getTime()) / 1000,
  );

  return {
    entry,
    user_name: userName,
    user_email: userEmail,
    joined_seconds_ago: joinedSecondsAgo,
  };
}

/**
 * Generates a human-readable summary of waitlist status.
 * @param position - User's position
 * @param totalWaiting - Total users waiting
 * @param estimatedMinutes - Estimated wait time in minutes
 * @returns Summary string
 */
export function generateWaitlistSummary(
  position: number,
  totalWaiting: number,
  estimatedMinutes: number | null,
): string {
  const positionStr = formatWaitlistPosition(position);
  let summary = `You are ${positionStr} in line`;

  if (totalWaiting > 1) {
    summary += ` (${totalWaiting} people waiting)`;
  }

  if (estimatedMinutes !== null) {
    if (estimatedMinutes < 60) {
      summary += `. Estimated wait: ~${estimatedMinutes} minutes`;
    } else {
      const hours = Math.floor(estimatedMinutes / 60);
      const mins = estimatedMinutes % 60;
      summary += `. Estimated wait: ~${hours}h ${mins}m`;
    }
  }

  return summary;
}
