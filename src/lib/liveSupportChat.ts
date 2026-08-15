import { createClient } from "./supabase/client";

export interface SupportSession {
  id: string;
  eventId: string;
  attendeeId: string;
  supportLeadId?: string;
  status: "active" | "blocked" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  sessionId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export const SUPPORT_UNREAD_SMS_FALLBACK_MS = 120000; // 2 minutes in milliseconds

/**
 * Checks if the live support chat widget is contextually active for an event.
 * Active window: Starts 1 hour before event start_time and closes 1 hour after end_time.
 */
export function isSupportWindowActive(
  startTime: string,
  endTime: string,
  now: Date = new Date(),
): boolean {
  if (!startTime || !endTime) return false;

  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const nowMs = now.getTime();

  const windowStartMs = startMs - 3600000; // 1 hour before start
  const windowEndMs = endMs + 3600000; // 1 hour after end

  return nowMs >= windowStartMs && nowMs <= windowEndMs;
}

/**
 * Determines whether an unread attendee message exceeds the 2-minute threshold
 * to trigger an urgent backup SMS notification to the Club President.
 */
export function shouldTriggerBackupSmsFallback(
  unreadDurationMs: number,
  thresholdMs = SUPPORT_UNREAD_SMS_FALLBACK_MS,
): boolean {
  return unreadDurationMs >= thresholdMs;
}

/**
 * 1-click ban/block RPC call for Support Leads to sever chat access for abusive users.
 */
export async function blockSupportUser(
  eventId: string,
  userId: string,
): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("block_support_user", {
    p_event_id: eventId,
    p_user_id: userId,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const res = data?.[0];
  return {
    success: res?.success ?? false,
    message: res?.message ?? "User blocked.",
  };
}
