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

    if (hasRsvpd) {
      // 1. Cancel RSVP: delete from RSVPs and waitlist
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

      return new Response(JSON.stringify({ success: true, status: "cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // 2. highly concurrent checkout flow utilizing PG advisory locks and backoff retry mechanism
      let attempts = 0;
      const maxAttempts = 5;
      let delay = 50; // initial wait time in milliseconds

      while (attempts < maxAttempts) {
        const { data, error } = await supabase.rpc("secure_event_checkout", {
          p_event_id: eventId,
          p_user_id: user.id,
        });

        if (error) {
          throw error;
        }

        if (data === "SUCCESS") {
          return new Response(JSON.stringify({ success: true, status: "approved" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        if (data === "ALREADY_RSVPED") {
          return new Response(JSON.stringify({ error: "You have already RSVPed to this event." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        if (data === "FULL") {
          return new Response(JSON.stringify({ error: "Event capacity has been reached." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 409,
          });
        }

        if (data === "BUSY") {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // exponential backoff multiplier
            continue;
          }
        }
      }

      // Lock acquisition failed after max retries
      return new Response(
        JSON.stringify({ error: "Server is busy processing checkouts. Please try again." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        },
      );
    }
  } catch (error) {
    console.error("Internal RSVP Error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: `An unexpected error occurred processing your RSVP: ${errorMsg}` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
