/**
 * Waitlist Types
 *
 * Type definitions for the Event RSVP Waitlist system.
 * When an event reaches max capacity, users can join a waitlist
 * and get automatically promoted when spots open up.
 */

export type WaitlistStatus = "waiting" | "promoted" | "expired" | "cancelled";

export interface WaitlistEntry {
  /** Unique identifier for the waitlist entry */
  id: string;
  /** The event this entry is for */
  event_id: string;
  /** The user who joined the waitlist */
  user_id: string;
  /** Position in the waitlist (1-indexed) */
  position: number;
  /** Current status of the entry */
  status: WaitlistStatus;
  /** Timestamp when the user joined the waitlist */
  joined_at: string;
  /** Timestamp when the entry was promoted to RSVP */
  promoted_at: string | null;
  /** Timestamp when the entry expired */
  expires_at: string | null;
  /** User notification preferences for this waitlist entry */
  notify_on_promotion: boolean;
  notify_on_position_change: boolean;
  /** Optional message from the user to event organizers */
  message: string | null;
}

export interface WaitlistConfig {
  /** Maximum number of users allowed on the waitlist */
  max_waitlist_size: number;
  /** How long a promoted user has to confirm their RSVP (in minutes) */
  promotion_window_minutes: number;
  /** Whether the waitlist is enabled for this event */
  enabled: boolean;
  /** Auto-promote next person when someone cancels */
  auto_promote: boolean;
}

export interface WaitlistStats {
  /** Total number of users on the waitlist */
  total_waiting: number;
  /** Number of users who have been promoted */
  total_promoted: number;
  /** Number of expired entries */
  total_expired: number;
  /** Number of cancelled entries */
  total_cancelled: number;
  /** Average wait time in minutes */
  average_wait_minutes: number;
  /** Longest wait time in minutes */
  max_wait_minutes: number;
}

export interface WaitlistPromotionResult {
  success: boolean;
  promoted_user_id: string | null;
  position: number | null;
  error: string | null;
}

export interface WaitlistEvent {
  /** Event ID */
  event_id: string;
  /** Event title */
  event_title: string;
  /** Event date */
  event_date: string;
  /** Current number of RSVPs */
  current_rsvps: number;
  /** Maximum attendees */
  max_attendees: number;
  /** Whether the event is at capacity */
  at_capacity: boolean;
  /** Number of users on the waitlist */
  waitlist_count: number;
  /** User's position on the waitlist (null if not on waitlist) */
  user_position: number | null;
  /** User's waitlist status (null if not on waitlist) */
  user_status: WaitlistStatus | null;
}

export interface CreateWaitlistEntryParams {
  event_id: string;
  user_id: string;
  message?: string;
  notify_on_promotion?: boolean;
  notify_on_position_change?: boolean;
}

export interface UpdateWaitlistEntryParams {
  id: string;
  status?: WaitlistStatus;
  notify_on_promotion?: boolean;
  notify_on_position_change?: boolean;
  position?: number;
  promoted_at?: string;
  expires_at?: string;
}

export interface WaitlistNotificationPayload {
  type: "position_changed" | "promoted" | "promotion_expired" | "event_cancelled";
  user_id: string;
  event_id: string;
  event_title: string;
  position?: number;
  previous_position?: number;
  promotion_deadline?: string;
}

export interface WaitlistQueueItem {
  entry: WaitlistEntry;
  user_name: string;
  user_email: string;
  joined_seconds_ago: number;
}

/** Default waitlist configuration for events */
export const DEFAULT_WAITLIST_CONFIG: WaitlistConfig = {
  max_waitlist_size: 50,
  promotion_window_minutes: 60,
  enabled: true,
  auto_promote: true,
};

/** Maximum waitlist entries to display per page */
export const WAITLIST_PAGE_SIZE = 20;

/** Maximum message length for waitlist entries */
export const MAX_WAITLIST_MESSAGE_LENGTH = 280;

/** Promotion window in milliseconds */
export const PROMOTION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Waitlist positions that trigger notification */
export const NOTIFICATION_POSITIONS = [1, 2, 3, 5, 10];
