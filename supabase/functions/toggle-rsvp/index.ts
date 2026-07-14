import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_WINDOW_MS = 2000; // 2 seconds

// In-memory store for rate limiting (persists across warm invocations in the same isolate)
const rateLimits = new Map<string, number>();

/**
 * Handles RSVP toggling with rate limiting.
 * @param {Request} req - The incoming HTTP request.
 * @returns {Promise<Response>} The HTTP response.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get JWT from authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
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

    // Rate Limiting Logic using in-memory store
    const rateLimitKey = `${user.id}:${eventId}`;
    const now = Date.now();
    const lastRequest = rateLimits.get(rateLimitKey);

    if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW_MS) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait before toggling again." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    rateLimits.set(rateLimitKey, now);

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
