// =============================================================================
// Edge Function: Request GPS Ping
// Issue: #4679 - Automated "Waitlist Promotion" Geographic Prioritization
// Description: Requests background GPS location updates from mobile apps
// for the top 10 waitlisted users when an event is imminent (< 60 minutes).
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { eventId } = await req.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: "eventId is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );

    // Call the RPC function to get users who need GPS pings
    const { data: usersNeedingLocation, error } = await supabaseClient.rpc(
      "request_gps_ping_for_waitlist",
      { p_event_id: eventId },
    );

    if (error) {
      console.error("[RequestGPSPing] RPC error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    // Filter to only users who actually need location updates
    const usersToPing = usersNeedingLocation?.filter((u: any) => u.needs_location_update) || [];

    if (usersToPing.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No users need location updates at this time",
          users_checked: usersNeedingLocation?.length || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // In a real implementation, this would send push notifications to mobile apps
    // requesting them to send their current GPS location
    // For now, we'll create notification records
    const { error: notificationError } = await supabaseClient.from("notifications").insert(
      usersToPing.map((u: any) => ({
        user_id: u.user_id,
        title: "📍 Location Update Requested",
        body: "Please update your location for better waitlist prioritization",
        type: "gps_ping_request",
        link: `/events/${eventId}`,
        metadata: {
          event_id: eventId,
          requested_at: new Date().toISOString(),
        },
      })),
    );

    if (notificationError) {
      console.error("[RequestGPSPing] Notification error:", notificationError);
      // Don't fail the request if notifications fail
    }

    return new Response(
      JSON.stringify({
        success: true,
        users_pinged: usersToPing.length,
        message: `GPS ping requested for ${usersToPing.length} users`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[RequestGPSPing] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
