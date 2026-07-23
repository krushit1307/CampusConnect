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

  // Rate Limiting Logic using Redis Upstash (10 requests per minute)
  const rateLimitResponse = await limitRate(req, "toggle-rsvp", { limit: 10, windowMs: 60000 });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
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

    // Execute RSVP logic securely
    if (hasRsvpd) {
      const { error } = await supabase
        .from("event_rsvps")
        .delete()
        .match({ event_id: eventId, user_id: user.id });

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("event_rsvps")
        .insert({ event_id: eventId, user_id: user.id });

      if (error) {
        throw error;
      }
    }

    return new Response(JSON.stringify({ success: true }), {
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
