// =============================================================================
// Service: Caterer Dietary Restriction Alert
// Issue: #3676 - Implement 'Automated "Dietary Restriction" Caterer Alert'
// Description: Automated Health Alert engine. If an RSVP containing a 'Severe / Life-Threatening'
// dietary tag is registered after the caterer RFP is finalized (rfp_finalized_at IS NOT NULL),
// automatically dispatches an emergency alert directly to vendor & tracks acknowledgment.
// =============================================================================

import { createClient } from "../lib/supabase/client";
import type { CatererDietaryAlert } from "../types/database";

/**
 * Checks if a dietary tag represents a severe or life-threatening allergy.
 */
export function isSevereDietaryTag(tag: string): boolean {
  if (!tag) return false;
  const lower = tag.toLowerCase().trim();
  return (
    lower.includes("severe") ||
    lower.includes("anaphylaxis") ||
    lower.includes("life_threatening") ||
    lower.includes("life-threatening") ||
    lower.includes("peanut_severe") ||
    lower.includes("celiac_severe") ||
    lower.includes("shellfish_severe")
  );
}

/**
 * Checks if RFP is finalized and triggers emergency caterer alert for severe dietary tags.
 */
export async function checkAndTriggerCatererDietaryAlert(
  eventId: string,
  userId: string,
  attendeeName: string,
  dietaryTags: string[],
): Promise<{
  triggered: boolean;
  alertData?: CatererDietaryAlert;
  alertMessage?: string;
  error?: string;
}> {
  if (!eventId || !attendeeName || !Array.isArray(dietaryTags) || dietaryTags.length === 0) {
    return { triggered: false };
  }

  // 1. Filter for severe dietary tags
  const severeTags = dietaryTags.filter((tag) => isSevereDietaryTag(tag));
  if (severeTags.length === 0) {
    return { triggered: false };
  }

  const supabase = createClient();

  try {
    // 2. Query event caterer contract to check rfp_finalized_at status
    const { data: contract, error: contractErr } = await supabase
      .from("event_caterer_contracts")
      .select("*, events:event_id(title)")
      .eq("event_id", eventId)
      .maybeSingle();

    if (contractErr || !contract || !contract.rfp_finalized_at) {
      // RFP is not finalized yet, no emergency post-RFP alert needed
      return { triggered: false };
    }

    const eventTitle = (contract as any)?.events?.title || "Campus Event";
    const severeTagSummary = severeTags.map((t) => t.toUpperCase().replace(/_/g, " ")).join(", ");

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const alertMessage = `URGENT UPDATE: A new attendee (${attendeeName}) with a severe ${severeTagSummary} has registered for ${eventTitle}. Please acknowledge this critical health update immediately.`;

    // 3. Insert caterer dietary alert record in PENDING acknowledgment status
    const { data: alertRecord, error: insertErr } = await supabase
      .from("caterer_dietary_alerts")
      .insert({
        event_id: eventId,
        user_id: userId || null,
        attendee_name: attendeeName,
        dietary_tag: severeTagSummary,
        severity_level: "SEVERE",
        caterer_email: contract.caterer_email,
        caterer_phone: contract.caterer_phone || null,
        token,
        alert_sent_at: new Date().toISOString(),
        acknowledgment_status: "PENDING",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    console.log(
      `[catererDietaryAlert] Emergency alert triggered for caterer (${contract.caterer_email}): ${alertMessage}`,
    );

    return {
      triggered: true,
      alertData: alertRecord as CatererDietaryAlert,
      alertMessage,
    };
  } catch (err: any) {
    console.error("[catererDietaryAlert] Error checking caterer alert:", err);
    return { triggered: false, error: err.message || "Failed to check caterer alert." };
  }
}

/**
 * Acknowledges a caterer dietary alert via vendor token (clears alert on organizer dashboard).
 */
export async function acknowledgeCatererDietaryAlert(
  token: string,
): Promise<{ success: boolean; data?: CatererDietaryAlert; error?: string }> {
  if (!token) return { success: false, error: "Missing token." };

  const supabase = createClient();

  try {
    const { data: updated, error } = await supabase
      .from("caterer_dietary_alerts")
      .update({
        acknowledgment_status: "ACKNOWLEDGED",
        acknowledged_at: new Date().toISOString(),
      })
      .eq("token", token)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: updated as CatererDietaryAlert };
  } catch (err: any) {
    console.error("[catererDietaryAlert] Acknowledgment error:", err);
    return { success: false, error: err.message || "Failed to acknowledge alert." };
  }
}

/**
 * Fetches all caterer dietary alerts for an event.
 */
export async function getCatererDietaryAlerts(eventId: string): Promise<CatererDietaryAlert[]> {
  if (!eventId) return [];

  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("caterer_dietary_alerts")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as CatererDietaryAlert[];
  } catch (err) {
    console.error("[catererDietaryAlert] Fetch alerts error:", err);
    return [];
  }
}
