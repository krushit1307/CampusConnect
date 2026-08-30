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

/**
 * Matches a student in crisis with an available, online peer responder.
 * Replaces the mock in CrisisAbTestBanner.tsx.
 */
export async function matchPeerResponder(): Promise<{ matched: boolean; roomId: string | null }> {
  const supabase = createClient();

  try {
    // 1. Get the current authenticated student
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error during matchmaking:", authError);
      return { matched: false, roomId: null };
    }

    // 2. Query for an available, online responder
    const { data: responders, error: responderError } = await supabase
      .from("users")
      .select("id")
      .eq("is_peer_responder", true)
      .eq("is_online", true)
      .limit(1); // Grabs the first available responder

    if (responderError || !responders || responders.length === 0) {
      console.log("No responders currently online.");
      return { matched: false, roomId: null };
    }

    const assignedResponder = responders[0];

    // 3. Create the secure anonymous support session
    const { data: session, error: sessionError } = await supabase
      .from("support_sessions")
      .insert({
        anonymous_student_id: user.id,
        responder_id: assignedResponder.id,
        status: "active",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("Failed to create support session:", sessionError);
      return { matched: false, roomId: null };
    }

    // 4. Return the new session ID to route the student into the chat
    return { matched: true, roomId: session.id };
  } catch (error) {
    console.error("Unexpected error in matchPeerResponder:", error);
    return { matched: false, roomId: null };
  }
}
