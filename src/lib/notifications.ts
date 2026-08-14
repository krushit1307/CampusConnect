// src/lib/notifications.ts
import { supabase } from "./supabase/client";

/**
 * A single notification row, returned by `get_categorized_notifications`.
 */
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  group_count: number;
  last_actor_name?: string | null;
}

/**
 * The response from `get_categorized_notifications`.
 */
export interface CategorizedNotifications {
  items: NotificationItem[];
  unread_by_type: Record<string, number>;
  total_unread: number;
  total_count: number;
  limit: number;
  offset: number;
}

/**
 * Fetch the calling user's notifications in a paginated, categorized form.
 *
 * Calls the `get_categorized_notifications` Postgres RPC, which
 * returns the latest N notifications plus per-type unread counts and
 * the total unread count for the bell badge.
 */
export async function fetchCategorizedNotifications(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<CategorizedNotifications | null> {
  const { data, error } = await supabase.rpc("get_categorized_notifications", {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error || !data) return null;
  return data as CategorizedNotifications;
}

/**
 * Fetch the calling user's unread notification count for the bell badge.
 *
 * Calls the `get_unread_notification_count` Postgres RPC, which uses
 * the `idx_notifications_user_unread` partial index for O(log n)
 * performance.
 */
export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_notification_count", {
    p_user_id: userId,
  });
  if (error || data === null || data === undefined) return 0;
  return data as number;
}

/**
 * Optimistically mark a single notification as read.
 *
 * Returns immediately after updating the local state; if the RPC
 * fails, the caller should revert the optimistic update.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
    p_user_id: userId,
  });
  if (error || !data) return false;
  return Boolean(data.marked_read);
}

/**
 * Mark all unread notifications as read. Optionally filter by type
 * (e.g., only "mention" notifications).
 *
 * Returns the number of notifications actually marked read.
 */
export async function markAllNotificationsRead(userId: string, type?: string): Promise<number> {
  const { data, error } = await supabase.rpc("mark_all_notifications_read", {
    p_user_id: userId,
    p_type: type ?? null,
  });
  if (error || !data) return 0;
  return Number(data.marked_read_count ?? 0);
}

/**
 * Subscribe to realtime INSERT/UPDATE events on the notifications
 * table for the given user. Returns an unsubscribe function.
 *
 * The Supabase realtime filter `user_id=eq.<userId>` ensures the
 * client only receives events for the calling user's notifications.
 *
 * Used by the bell icon to update the unread count in real time
 * without polling.
 */
export function subscribeToNotifications(
  userId: string,
  onInsert: () => void,
  onUpdate: () => void,
): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      () => onInsert(),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      () => onUpdate(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Format a notification message for display, expanding the grouped
 * form when `group_count > 1`.
 *
 * Examples:
 *   - "Alice liked your event." (group_count = 1)
 *   - "Alice and 49 others liked your event." (group_count = 50)
 */
export function formatNotificationMessage(notif: NotificationItem): string {
  if (notif.group_count <= 1) {
    return notif.message;
  }
  // Replace "Someone" / actor name at the start of the message with
  // the grouped form. The trigger stores the latest actor as
  // actor_name and the previous one as last_actor_name.
  const others = notif.group_count - 1;
  const baseMessage = notif.message;
  const actorName = notif.actor_name ?? "Someone";
  const groupedIntro =
    others === 1 ? `${actorName} and 1 other` : `${actorName} and ${others} others`;
  // Try to replace the leading actor name in the message.
  if (baseMessage.startsWith(actorName)) {
    return groupedIntro + baseMessage.slice(actorName.length);
  }
  // Fallback: prepend the grouped intro.
  return `${groupedIntro} — ${baseMessage}`;
}

/**
 * Categorize a notification by its `type` for the inbox dropdown tabs.
 */
export type NotificationCategory = "all" | "mentions" | "events" | "messages" | "system";

export function categorize(type: string): NotificationCategory {
  if (type === "mention") return "mentions";
  if (type.startsWith("event_") || type === "event") return "events";
  if (type.startsWith("message") || type === "dm") return "messages";
  if (type === "system" || type === "announcement") return "system";
  return "all";
}

/**
 * Filter notifications by category (used by the inbox dropdown tabs).
 */
export function filterByCategory(
  items: NotificationItem[],
  category: NotificationCategory,
): NotificationItem[] {
  if (category === "all") return items;
  return items.filter((n) => categorize(n.type) === category);
}
