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
 */
export async function patchRescheduleEvent({
  eventId,
  newStartIso,
  newEndIso,
}: RescheduleEventApiParams): Promise<RescheduleApiResponse> {
  const supabase = createClient();

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
    console.warn("REST API endpoint unavailable, falling back to direct Supabase table update", apiError);
  }

  // 2. Direct Supabase Client fallback update
  const { error } = await supabase
    .from("events")
    .update({
      start_date: newStartIso,
      end_date: newEndIso,
      event_date: newStartIso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    throw new Error(`Failed to update event schedule: ${error.message}`);
  }

  return {
    success: true,
    eventId,
    updatedStart: newStartIso,
    updatedEnd: newEndIso,
    message: "Event schedule updated in database",
  };
}
