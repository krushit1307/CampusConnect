import { createClient } from "@/lib/supabase/client";

// =============================================================================
// Service: Event Series Catch-Up Service
// Issue: #4215 - Implement 'Automated "Event Series" Catch-Up Mode'
// =============================================================================

export interface EventSeriesCatchup {
  id: string;
  series_id: string;
  missed_event_id: string;
  next_event_id?: string | null;
  user_id: string;
  recording_url?: string | null;
  materials_url?: string | null;
  email_sent: boolean;
  email_sent_at?: string | null;
  vod_clicked: boolean;
  vod_clicked_at?: string | null;
  materials_clicked: boolean;
  materials_clicked_at?: string | null;
  created_at: string;
}

export interface CatchupEmailTemplateParams {
  eventTitle: string;
  nextEventTitle?: string;
  recordingUrl?: string | null;
  materialsUrl?: string | null;
}

/**
 * Builds the automated Catch-Up notification message for no-show attendees.
 */
export function buildCatchUpEmailContent({
  eventTitle,
  nextEventTitle,
  recordingUrl,
  materialsUrl,
}: CatchupEmailTemplateParams): { subject: string; body: string } {
  const nextTarget = nextEventTitle ? `before ${nextEventTitle}` : "before the next session";
  const subject = `We missed you at ${eventTitle}! Here's how to catch up`;

  const links: string[] = [];
  if (recordingUrl) links.push(`• Watch Recording (VOD): ${recordingUrl}`);
  if (materialsUrl) links.push(`• Slide Deck & Materials: ${materialsUrl}`);

  const body = `
We missed you at ${eventTitle}!

Don't worry about falling behind in the series. Here is everything you need so you can catch up ${nextTarget}:

${links.join("\n")}

Stay on track and see you at the next event!
  `.trim();

  return { subject, body };
}

/**
 * Fetches catch-up materials for the current logged-in user for a specific series/event.
 */
export async function getUserSeriesCatchup(
  missedEventId: string,
): Promise<EventSeriesCatchup | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_series_catchups")
    .select("*")
    .eq("missed_event_id", missedEventId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user series catchup:", error);
    return null;
  }

  return data as EventSeriesCatchup | null;
}

/**
 * Tracks a click on a VOD or Materials link for recovery analytics.
 */
export async function trackCatchupClick(
  catchupId: string,
  linkType: "vod" | "materials",
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.rpc("record_series_catchup_click", {
    p_catchup_id: catchupId,
    p_link_type: linkType,
  });

  if (error) {
    console.error("Error recording catchup click:", error);
    return false;
  }

  return true;
}

/**
 * Triggers series catch-up processing for an event manually or via cron.
 */
export async function triggerSeriesCatchupProcessing(
  eventId: string,
): Promise<{ success: boolean; catchupsGenerated?: number; message?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("process_series_no_show_catchups", {
    p_event_id: eventId,
  });

  if (error) {
    console.error("Error triggering series catchup processing:", error);
    return { success: false, message: error.message };
  }

  return {
    success: true,
    catchupsGenerated: data?.catchups_generated,
  };
}
