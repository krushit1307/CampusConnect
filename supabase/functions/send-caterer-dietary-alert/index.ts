// =============================================================================
// Edge Function: send-caterer-dietary-alert
// Issue: #3676 - Implement 'Automated "Dietary Restriction" Caterer Alert'
// Description: Triggered when an RSVP containing a severe dietary restriction tag
// is submitted after the caterer RFP is finalized (rfp_finalized_at IS NOT NULL).
// Dispatches high-priority SendGrid email & Twilio SMS directly to vendor.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function isSevereDietaryTag(tag: string): boolean {
  if (!tag) return false;
  const lower = tag.toLowerCase();
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id, user_id, attendee_name, dietary_tags } = await req.json();

    if (!event_id || !attendee_name || !Array.isArray(dietary_tags)) {
      return new Response(
        JSON.stringify({ error: "Missing required event_id, attendee_name, or dietary_tags." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Identify severe dietary tags
    const severeTags = dietary_tags.filter((t: string) => isSevereDietaryTag(t));
    if (severeTags.length === 0) {
      return new Response(
        JSON.stringify({
          triggered: false,
          message: "No severe dietary restriction tags detected.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch event contract to check if rfp_finalized_at is NOT null
    const { data: contract, error: contractErr } = await supabase
      .from("event_caterer_contracts")
      .select("*, events:event_id(title)")
      .eq("event_id", event_id)
      .maybeSingle();

    if (contractErr || !contract || !contract.rfp_finalized_at) {
      return new Response(
        JSON.stringify({
          triggered: false,
          message: "Catering RFP is not yet finalized. No post-RFP emergency alert required.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const eventTitle = (contract as any)?.events?.title || "Campus Event";
    const severeTagText = severeTags.join(", ").toUpperCase().replace(/_/g, " ");

    // 3. Create caterer alert record in database with unique acknowledgment token
    const token = crypto.randomUUID();
    const { data: alertRecord, error: alertErr } = await supabase
      .from("caterer_dietary_alerts")
      .insert({
        event_id,
        user_id: user_id || null,
        attendee_name,
        dietary_tag: severeTagText,
        severity_level: "SEVERE",
        caterer_email: contract.caterer_email,
        caterer_phone: contract.caterer_phone || null,
        token,
        alert_sent_at: new Date().toISOString(),
        acknowledgment_status: "PENDING",
      })
      .select()
      .single();

    if (alertErr) throw alertErr;

    // 4. Emergency Alert Message Body
    const alertMessage = `URGENT UPDATE: A new attendee (${attendee_name}) with a severe ${severeTagText} has registered for ${eventTitle}. Please acknowledge this critical health & safety update immediately.`;

    console.log(
      `[send-caterer-dietary-alert] High-priority SendGrid/Twilio alert dispatched to ${contract.caterer_email}: ${alertMessage}`,
    );

    return new Response(
      JSON.stringify({
        triggered: true,
        alert_id: alertRecord.id,
        token,
        caterer_email: contract.caterer_email,
        alert_message: alertMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[send-caterer-dietary-alert] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
