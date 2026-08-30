// =============================================================================
// Edge Function: reserve-auditorium-seat
// Issue: #3873 - Build an 'Interactive Seat Map' for Large Auditoriums
// Description: Manages temporary seat locking during checkout to prevent double-booking
// and confirms specific seat assignments (e.g. 'Row B, Seat 14') on RSVPs.
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
    const { action, event_id, seat_id, seat_label, section, user_id, rsvp_id } = await req.json();

    if (!event_id || !seat_id || !user_id) {
      return new Response(JSON.stringify({ error: "Missing event_id, seat_id, or user_id." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resolvedLabel = seat_label || seat_id.replace(/-/g, " ");

    if (action === "CONFIRM") {
      if (!rsvp_id) {
        return new Response(JSON.stringify({ error: "Missing rsvp_id for CONFIRM action." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: confirmResult, error: confirmErr } = await supabase.rpc(
        "confirm_seat_reservation",
        {
          p_event_id: event_id,
          p_seat_id: seat_id,
          p_seat_label: resolvedLabel,
          p_user_id: user_id,
          p_rsvp_id: rsvp_id,
        },
      );

      if (confirmErr) throw confirmErr;

      return new Response(
        JSON.stringify({ success: true, action: "CONFIRM", result: confirmResult }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Default action: LOCK
    const { data: lockResult, error: lockErr } = await supabase.rpc("lock_event_seat", {
      p_event_id: event_id,
      p_seat_id: seat_id,
      p_seat_label: resolvedLabel,
      p_section: section || "General",
      p_user_id: user_id,
      p_lock_minutes: 10,
    });

    if (lockErr) throw lockErr;

    if (lockResult && lockResult.success === false) {
      return new Response(
        JSON.stringify({
          success: false,
          error: lockResult.error || "Seat double-booking prevented.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, action: "LOCK", result: lockResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[reserve-auditorium-seat] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
