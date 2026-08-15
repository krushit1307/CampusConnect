// =============================================================================
// Edge Function: Get Next Event for Widget
// Issue: #3228 - Develop a 'Dynamic Event Countdown Widget' for Mobile Homescreens
// Description: A lightweight, highly optimized Edge Function designed to be 
// polled by native iOS/Android Widget Extensions every 15 minutes. It returns 
// only the minimal payload required to render the homescreen widget.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Authenticate the user via JWT
        // The native widget extension must pass the user's auth token via the App Group container
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            throw new Error("Missing authorization header");
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("Unauthorized: Invalid or expired token");
        }

        // 2. Fetch the single next upcoming event the user has RSVP'd to
        const now = new Date().toISOString();

        const { data: nextEvent, error: fetchError } = await supabase
            .from("event_rsvps")
            .select(`
        event_id,
        events (
          id,
          title,
          location,
          event_date,
          end_date,
          cover_image_url
        )
      `)
            .eq("user_id", user.id)
            .eq("status", "confirmed")
            .gt("events.event_date", now)
            .order("events.event_date", { ascending: true })
            .limit(1)
            .maybeSingle();

        if (fetchError) {
            console.error("[GetNextEvent] Fetch error:", fetchError);
            throw fetchError;
        }

        // 3. Handle Empty State (No upcoming events)
        if (!nextEvent || !nextEvent.events) {
            return new Response(
                JSON.stringify({
                    hasEvent: false,
                    message: "Your schedule is clear. Tap to discover events!"
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        // 4. Return minimal payload for the widget
        const event = nextEvent.events as any;
        const payload = {
            hasEvent: true,
            eventId: event.id,
            title: event.title,
            location: event.location || "TBA",
            startDate: event.event_date,
            endDate: event.end_date,
            coverImage: event.cover_image_url,
            deepLink: `campusconnect://events/${event.id}` // Custom URL scheme for deep linking
        };

        return new Response(
            JSON.stringify(payload),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[GetNextEvent] Error:", error);

        // Return 401 for auth errors so the widget knows to prompt for re-login
        const status = error.message.includes("Unauthorized") ? 401 : 500;

        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status }
        );
    }
});
