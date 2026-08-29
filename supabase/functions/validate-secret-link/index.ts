// =============================================================================
// Edge Function: Validate Secret Link
// Issue: #4672 - Dynamic "Early Bird" Secret Unlock Links
// Description: Validates secret unlock hash and returns secret tier details
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
    const { eventId, unlockHash } = await req.json();

    if (!eventId || !unlockHash) {
      return new Response(JSON.stringify({ error: "eventId and unlockHash are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    // Call the RPC function to validate the unlock hash
    const { data, error } = await supabaseClient.rpc("validate_unlock_hash", {
      p_event_id: eventId,
      p_unlock_hash: unlockHash,
    });

    if (error) {
      console.error("[ValidateSecretLink] RPC error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({
          valid: false,
          message: "Invalid or expired secret link",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const tier = data[0];
    if (!tier.is_valid) {
      return new Response(
        JSON.stringify({
          valid: false,
          message: "Invalid or expired secret link",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        tier: {
          id: tier.tier_id,
          name: tier.tier_name,
          price: tier.tier_price,
          capacity: tier.tier_capacity,
          uses_remaining: tier.uses_remaining,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[ValidateSecretLink] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
