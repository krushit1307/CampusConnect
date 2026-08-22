// =============================================================================
// Edge Function: noise-alert-webhook
// Issue: #3684 - Build a 'Real-Time "Decibel/Noise" Violation Alert'
// Description: Webhook endpoint (/api/iot/noise-alert) receiving hardware IoT payloads.
// Triggers red alerts on Organizer's Dashboard when dB > 90 for sustained 5 mins
// and logs liability audit records.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const DECIBEL_LIMIT = 90;
export const DURATION_LIMIT_MINS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { venue_id, venue_name, decibels, duration_minutes } = await req.json();

    if (!venue_id || typeof decibels !== "number" || typeof duration_minutes !== "number") {
      return new Response(
        JSON.stringify({ error: "Missing venue_id, decibels, or duration_minutes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check decibel and duration threshold (dB > 90 for sustained >= 5 mins)
    if (decibels <= DECIBEL_LIMIT || duration_minutes < DURATION_LIMIT_MINS) {
      return new Response(
        JSON.stringify({
          violation: false,
          message: `Noise level (${decibels}dB for ${duration_minutes}m) within legal thresholds.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Query active event for this venue
    const { data: activeEvents } = await supabase
      .from("events")
      .select("id, title, location")
      .or(`location.ilike.%${venue_id}%,location.ilike.%${venue_name || venue_id}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    const activeEvent = activeEvents?.[0];
    const eventId = activeEvent?.id || null;
    const resolvedVenueName = venue_name || activeEvent?.location || venue_id;

    // 2. Compute escalated warning count for this event / venue
    let warningCount = 1;
    if (eventId) {
      const { count } = await supabase
        .from("noise_violation_logs")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId);

      warningCount = (count || 0) + 1;
    }

    // 3. Format warning alert message
    const alertMessage = `WARNING: Noise levels have exceeded ${decibels}dB for ${duration_minutes} minutes (Warning #${warningCount}). Lower the volume immediately to avoid security intervention.`;

    // 4. Log alert to noise_violation_logs table (Liability Tracking)
    const { data: logRecord, error: insertError } = await supabase
      .from("noise_violation_logs")
      .insert({
        event_id: eventId,
        venue_id,
        venue_name: resolvedVenueName,
        decibels,
        duration_minutes,
        warning_level: decibels >= 95 ? "CRITICAL" : "WARNING",
        warning_count: warningCount,
        alert_message: alertMessage,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log(
      `[noise-alert-webhook] Dispatched decibel violation alert for ${resolvedVenueName}: ${alertMessage}`,
    );

    return new Response(
      JSON.stringify({
        violation: true,
        log_id: logRecord.id,
        event_id: eventId,
        warning_count: warningCount,
        alert_message: alertMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[noise-alert-webhook] Webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
