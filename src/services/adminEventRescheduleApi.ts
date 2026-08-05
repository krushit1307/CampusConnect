import { createClient } from "@/lib/supabase/client";

export interface RescheduleEventApiParams {
  eventId: string;
  newStartIso: string;
  newEndIso: string;
}

export interface RescheduleApiResponse {
  success: boolean;
  eventId: string;
  updatedStart: string;
  updatedEnd: string;
  message: string;
}

/**
 * Executes PATCH request / database update to reschedule an event to a new start and end time.
 *
 * The update uses optimistic concurrency control (version column) so a concurrent
 * edit/reschedule of the same event is detected instead of silently overwritten.
 */
export async function patchRescheduleEvent({
  eventId,
  newStartIso,
  newEndIso,
}: RescheduleEventApiParams): Promise<RescheduleApiResponse> {
  const supabase = createClient();

  // Read the current version so the write can be guarded with OCC
  const { data: current, error: fetchError } = await supabase
    .from("events")
    .select("version")
    .eq("id", eventId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load event version: ${fetchError.message}`);
  }

  const targetVersion = current?.version ?? 1;

  try {
    // 1. First attempt PATCH via REST endpoint if available
    const response = await fetch(`/api/events/${eventId}/reschedule`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start_date: newStartIso,
        end_date: newEndIso,
        event_date: newStartIso,
        version: targetVersion,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        eventId,
        updatedStart: newStartIso,
        updatedEnd: newEndIso,
        message: data.message || "Event rescheduled successfully",
      };
    }
  } catch (apiError) {
    // Fall back to direct Supabase database update
    console.warn(
      "REST API endpoint unavailable, falling back to direct Supabase table update",
      apiError,
    );
  }

  // 2. Direct Supabase Client fallback update (optimistic locking on version)
  const { data, error } = await supabase
    .from("events")
    .update({
      start_date: newStartIso,
      end_date: newEndIso,
      event_date: newStartIso,
      updated_at: new Date().toISOString(),
      version: targetVersion + 1,
    })
    .eq("id", eventId)
    .eq("version", targetVersion)
    .select("id, version");

  if (error) {
    throw new Error(`Failed to update event schedule: ${error.message}`);
  }

  // rowCount === 0 -> the event was modified by another user concurrently
  if (!data || data.length === 0) {
    throw new Error(
      "Conflict: This event was modified by another user. Please refresh and try again.",
    );
  }

  return {
    success: true,
    eventId,
    updatedStart: newStartIso,
    updatedEnd: newEndIso,
    message: "Event schedule updated in database",
  };
}
