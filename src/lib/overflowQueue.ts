import { supabase } from "./supabase";

/**
 * Client-side service for the Real-Time Event Capacity Overflow Queue.
 *
 * Provides functions to:
 *   - Join the virtual overflow queue when an event is at capacity
 *   - Process physical checkouts (door scan-outs) and notify next in queue
 *   - Claim a seat when notified
 *   - Get current queue status
 *   - Subscribe to real-time queue updates
 */

export type VirtualAttendeeStatus =
  | "waiting"
  | "notified"
  | "claimed"
  | "expired"
  | "admitted";

export interface OverflowQueueStatus {
  event_id: string;
  queue_count: number;
  notified_count: number;
  admitted_count: number;
  overflow_stream_url: string | null;
  user_position: {
    queue_position: number;
    status: VirtualAttendeeStatus;
    claim_deadline: string | null;
  } | null;
}

export interface OverflowQueueResult {
  success: boolean;
  queue_position?: number;
  message?: string;
  error?: string;
}

/**
 * Join the virtual overflow queue for an event that is at capacity.
 */
export async function joinVirtualQueue(
  eventId: string
): Promise<OverflowQueueResult> {
  const { data, error } = await supabase.functions.invoke("overflow-queue", {
    body: { action: "join", event_id: eventId },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as OverflowQueueResult;
}

/**
 * Notify the door scanner that a physical attendee has left.
 * This triggers notification to the next person in the virtual queue.
 */
export async function processPhysicalCheckout(
  eventId: string,
  checkedOutUserId: string
): Promise<OverflowQueueResult> {
  const { data, error } = await supabase.functions.invoke("overflow-queue", {
    body: {
      action: "checkout",
      event_id: eventId,
      checked_out_user_id: checkedOutUserId,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as OverflowQueueResult;
}

/**
 * Claim a seat at the door after being notified.
 * Must be called within the 2-minute claim window.
 */
export async function claimSeat(
  eventId: string
): Promise<OverflowQueueResult> {
  const { data, error } = await supabase.functions.invoke("overflow-queue", {
    body: { action: "claim", event_id: eventId },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as OverflowQueueResult;
}

/**
 * Get the current overflow queue status for an event.
 */
export async function getOverflowQueueStatus(
  eventId: string
): Promise<OverflowQueueStatus | null> {
  const { data, error } = await supabase.functions.invoke("overflow-queue", {
    body: { action: "status", event_id: eventId },
  });

  if (error) {
    console.error("Failed to get overflow queue status:", error);
    return null;
  }

  return data as OverflowQueueStatus;
}

/**
 * Check if an event is at full capacity (all physical seats taken).
 */
export async function isEventAtCapacity(eventId: string): Promise<boolean> {
  const { data: event } = await supabase
    .from("events")
    .select("max_attendees")
    .eq("id", eventId)
    .single();

  if (!event || !event.max_attendees) return false;

  const { count } = await supabase
    .from("event_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  return (count ?? 0) >= event.max_attendees;
}

/**
 * Subscribe to real-time overflow queue updates for an event.
 * Returns an unsubscribe function.
 */
export function subscribeToOverflowQueue(
  eventId: string,
  callback: (payload: OverflowQueueStatus) => void
): () => void {
  const channel = supabase
    .channel(`overflow-queue:${eventId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "virtual_attendees",
        filter: `event_id=eq.${eventId}`,
      },
      async () => {
        const status = await getOverflowQueueStatus(eventId);
        if (status) callback(status);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Generate a QR code payload for the overflow room.
 * This QR, when scanned by a student, adds them to the virtual queue.
 */
export function generateOverflowQrPayload(eventId: string): string {
  return JSON.stringify({
    type: "overflow_queue",
    event_id: eventId,
    timestamp: Date.now(),
  });
}
