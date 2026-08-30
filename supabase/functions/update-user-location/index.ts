// =============================================================================
// Edge Function: Update User Location
// Issue: #4679 - Automated "Waitlist Promotion" Geographic Prioritization
// Description: Allows mobile apps to update user's GPS location for
// geographic waitlist prioritization.
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
    const { latitude, longitude } = await req.json();

    if (latitude === undefined || longitude === undefined) {
      return new Response(JSON.stringify({ error: "latitude and longitude are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate coordinates
    if (typeof latitude !== "number" || latitude < -90 || latitude > 90) {
      return new Response(
        JSON.stringify({ error: "Invalid latitude. Must be between -90 and 90." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    if (typeof longitude !== "number" || longitude < -180 || longitude > 180) {
      return new Response(
        JSON.stringify({ error: "Invalid longitude. Must be between -180 and 180." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
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

    // Call the RPC function to update user location
    const { data, error } = await supabaseClient.rpc("update_user_location", {
      p_latitude: latitude,
      p_longitude: longitude,
    });

    if (error) {
      console.error("[UpdateUserLocation] RPC error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[UpdateUserLocation] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
