import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Returns the RSVP list for an event (name, email, RSVP date, status) as JSON.
 * Only the event's organizer (events.created_by) may call this.
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

    const { eventId } = await req.json();
    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm the event exists and that the caller is the organizer
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, created_by")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "Only the event organizer can export RSVPs." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch RSVPs joined with profile info
    const { data: rsvps, error: rsvpError } = await supabase
      .from("event_rsvps")
      .select("user_id, checked_in, rsvp_at, profiles (full_name)")
      .eq("event_id", eventId);

    if (rsvpError) {
      throw rsvpError;
    }

    // Look up emails via the admin API (email lives in auth.users, not profiles)
    const rows = await Promise.all(
      (rsvps ?? []).map(async (r) => {
        const { data: userData } = await supabase.auth.admin.getUserById(r.user_id);
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return {
          name: profile?.full_name ?? "",
          email: userData?.user?.email ?? "",
          rsvp_date: r.rsvp_at ?? "",
          status: r.checked_in ? "Checked In" : "Registered",
        };
      }),
    );

    return new Response(JSON.stringify({ rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Internal Export RSVP Error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred exporting RSVPs." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
