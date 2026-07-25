import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { limitRate } from "../shared/rate_limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Handles RSVP toggling with rate limiting.
 * @param {Request} req - The incoming HTTP request.
 * @returns {Promise<Response>} The HTTP response.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Rate Limiting Logic using Redis Upstash (60 requests per minute)
    // Applied inside try block to ensure errors are caught gracefully
    const rateLimitResponse = await limitRate(req, "toggle-rsvp", { limit: 60, windowMs: 60000 });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let user;

    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { eventId, hasRsvpd } = await req.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute RSVP logic securely with concurrency protection
    let status = "cancelled";
    if (hasRsvpd) {
      const { error: rsvpErr } = await supabase
        .from("event_rsvps")
        .delete()
        .match({ event_id: eventId, user_id: user.id });

      if (rsvpErr) {
        throw rsvpErr;
      }

      const { error: waitlistErr } = await supabase
        .from("event_waitlist")
        .delete()
        .match({ event_id: eventId, user_id: user.id });

      if (waitlistErr) {
        throw waitlistErr;
      }
    } else {
      const { data, error } = await supabase.rpc("safe_rsvp", {
        target_event_id: eventId,
        target_user_id: user.id,
      });

      if (error) {
        throw error;
      }
      status = data;
    }

    return new Response(JSON.stringify({ success: true, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Internal RSVP Error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred processing your RSVP." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
