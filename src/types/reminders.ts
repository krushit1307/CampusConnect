/**
 * Campus Event Reminders
 *
 * Smart reminder system for upcoming campus events. Users set custom
 * reminders with configurable lead times, recurring patterns, and
 * notification preferences. Includes a countdown dashboard.
 */

export type ReminderLeadTime = "15min" | "30min" | "1hour" | "2hours" | "1day" | "3days" | "1week";
export type ReminderFrequency = "once" | "daily" | "weekly";
export type ReminderStatus = "active" | "triggered" | "snoozed" | "dismissed" | "expired";

export interface EventReminder {
  id: string;
  event_id: string;
  event_title: string;
  event_date: string;
  event_location: string | null;
  event_club_name: string | null;
  /** User's display name */
  user_name: string;
  /** Lead time before event to trigger reminder */
  lead_time: ReminderLeadTime;
  /** How often to re-remind */
  frequency: ReminderFrequency;
  /** Custom personal note attached to the reminder */
  personal_note: string | null;
  /** Whether browser notification permission has been granted */
  browser_notification: boolean;
  /** Whether email notification is enabled */
  email_notification: boolean;
  /** Current status */
  status: ReminderStatus;
  /** ISO timestamp when the reminder was last triggered */
  last_triggered_at: string | null;
  /** ISO timestamp when the reminder was dismissed */
  dismissed_at: string | null;
  /** ISO timestamp when the reminder was created */
  created_at: string;
  /** ISO timestamp when the reminder was updated */
  updated_at: string;
  /** Whether the reminder is pinned to top */
  is_pinned: boolean;
}

export interface ReminderNotification {
  id: string;
  reminder_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface ReminderStats {
  total_reminders: number;
  active_count: number;
  triggered_count: number;
  upcoming_events: number;
  most_reminded_event: string | null;
  average_lead_time: string;
}

export interface CreateReminderPayload {
  event_id: string;
  event_title: string;
  event_date: string;
  event_location: string | null;
  event_club_name: string | null;
  user_name: string;
  lead_time: ReminderLeadTime;
  frequency: ReminderFrequency;
  personal_note: string | null;
  browser_notification: boolean;
  email_notification: boolean;
}

export interface ReminderFilters {
  status: ReminderStatus | "all";
  frequency: ReminderFrequency | "all";
  search: string;
  sort: "soonest" | "newest" | "oldest";
}

export const LEAD_TIME_OPTIONS: Record<ReminderLeadTime, { label: string; minutes: number; description: string }> = {
  "15min": { label: "15 minutes", minutes: 15, description: "Just in time" },
  "30min": { label: "30 minutes", minutes: 30, description: "Quick heads up" },
  "1hour": { label: "1 hour", minutes: 60, description: "Plan ahead" },
  "2hours": { label: "2 hours", minutes: 120, description: "Get ready" },
  "1day": { label: "1 day", minutes: 1440, description: "Tomorrow" },
  "3days": { label: "3 days", minutes: 4320, description: "Early warning" },
  "1week": { label: "1 week", minutes: 10080, description: "Plan your week" },
};

export const FREQUENCY_OPTIONS: Record<ReminderFrequency, { label: string; icon: string; description: string }> = {
  once: { label: "One-time", icon: "🔔", description: "Remind me once" },
  daily: { label: "Daily", icon: "🔄", description: "Every day until event" },
  weekly: { label: "Weekly", icon: "📅", description: "Every week until event" },
};

export const STATUS_META: Record<ReminderStatus, { label: string; bgClass: string; dotClass: string }> = {
  active: { label: "Active", bgClass: "bg-emerald-100 text-emerald-700", dotClass: "bg-emerald-500" },
  triggered: { label: "Triggered", bgClass: "bg-amber-100 text-amber-700", dotClass: "bg-amber-500" },
  snoozed: { label: "Snoozed", bgClass: "bg-blue-100 text-blue-700", dotClass: "bg-blue-500" },
  dismissed: { label: "Dismissed", bgClass: "bg-gray-100 text-gray-600", dotClass: "bg-gray-400" },
  expired: { label: "Expired", bgClass: "bg-red-100 text-red-600", dotClass: "bg-red-400" },
};
