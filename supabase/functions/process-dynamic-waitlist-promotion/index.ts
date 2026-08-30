// =============================================================================
// Edge Function: process-dynamic-waitlist-promotion
// Issue: #3874 - Develop a 'Dynamic Waitlist Priority' Algorithm
// Description: Evaluates weighted Priority Scores for all waitlisted users when an event
// spot opens up and promotes the highest-scoring user to 'Registered'.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id } = await req.json();

    if (!event_id) {
      return new Response(JSON.stringify({ error: "Missing event_id." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch event title
    const { data: event } = await supabase
      .from("events")
      .select("id, title")
      .eq("id", event_id)
      .single();

    const eventTitle = event?.title || "Event";

    // 2. Invoke RPC promote_top_dynamic_waitlist_user
    const { data: promoteResult, error: promoteErr } = await supabase.rpc(
      "promote_top_dynamic_waitlist_user",
      {
        p_event_id: event_id,
      },
    );

    if (promoteErr) throw promoteErr;

    if (!promoteResult || promoteResult.success === false) {
      return new Response(
        JSON.stringify({ success: false, message: promoteResult?.message || "Waitlist is empty" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      `[process-dynamic-waitlist-promotion] Promoted ${promoteResult.user_full_name} to Registered for ${eventTitle} (Priority Score: ${promoteResult.priority_score})`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        promoted_user_id: promoteResult.promoted_user_id,
        user_full_name: promoteResult.user_full_name,
        priority_score: promoteResult.priority_score,
        notification_message: `🎉 Great news! A spot opened up for ${eventTitle}. Based on your high platform reputation (Priority Score: ${promoteResult.priority_score}), you've been promoted to Registered!`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[process-dynamic-waitlist-promotion] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
