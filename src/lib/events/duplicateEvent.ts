import { SupabaseClient } from "@supabase/supabase-js";
import { addDays, parseISO } from "date-fns";

/**
 * Duplicates an event, shifting its start/end/event dates 7 days forward
 * and creating it as a draft.
 * 
 * @returns The newly created event ID.
 */
export async function duplicateEvent(
  supabase: SupabaseClient,
  originalEventId: string,
  userId: string
): Promise<string> {
  // 1. Fetch original event metadata
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("*")
    .eq("id", originalEventId)
    .single();

  if (fetchError || !event) {
    throw new Error(fetchError?.message || "Original event not found");
  }

  // 2. Clone metadata & shift dates by 7 days
  const shiftDate = (dateString: string | null) => {
    if (!dateString) return null;
    return addDays(parseISO(dateString), 7).toISOString();
  };

  const {
    id, // strip out old ID
    created_at, // strip
    updated_at, // strip
    created_by, // strip, we'll assign to the current user
    status, // override
    event_date,
    start_date,
    end_date,
    ...restOfEvent
  } = event;

  const newEventData = {
    ...restOfEvent,
    created_by: userId,
    status: "draft", // as requested
    event_date: shiftDate(event_date),
    start_date: shiftDate(start_date),
    end_date: shiftDate(end_date),
  };

  // 3. Insert the new duplicated event
  const { data: newEvent, error: insertError } = await supabase
    .from("events")
    .insert(newEventData)
    .select("id")
    .single();

  if (insertError || !newEvent) {
    throw new Error(insertError?.message || "Failed to create duplicate event");
  }

  return newEvent.id;
}
