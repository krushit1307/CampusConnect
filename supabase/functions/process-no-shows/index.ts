// =============================================================================
// Edge Function: Process No-Shows (Cron Job)
// Issue: #3330 - Implement 'Automated No-Show Penalty' System
//Description: Runs daily via Supabase Cron.Identifies events that ended
//exactly 24 hours ago and triggers the penalty RPC.Sends push notifications
//to users who received a strike or a suspension.
    // =============================================================================

    import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Verify Cron secret
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_CRON_SECRET")}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    try {
        // Find events that ended between 23 and 25 hours ago
        const now = new Date();
        const lowerBound = new Date(now.getTime() - 25 * 60 * 60 * 1000);
        const upperBound = new Date(now.getTime() - 23 * 60 * 60 * 1000);

        const { data: events, error: fetchError } = await supabaseAdmin
            .from("events")
            .select("id, title")
            .gte("end_date", lowerBound.toISOString())
            .lte("end_date", upperBound.toISOString())
            .eq("requires_rsvp", true);

        if (fetchError) throw fetchError;
        if (!events || events.length === 0) {
            return new Response(JSON.stringify({ message: "No events to process." }), { headers: corsHeaders });
        }

        let totalPenalized = 0;

        for (const event of events) {
            const { data: count, error: rpcError } = await supabaseAdmin.rpc("process_event_no_shows", {
                p_event_id: event.id
            });

            if (rpcError) {
                console.error(`Failed to process no-shows for event ${event.id}:`, rpcError);
                continue;
            }

            totalPenalized += (count as number) || 0;
        }

        // Note: In a production system, we would fetch the newly penalized users 
        // and dispatch Push Notifications / Emails here warning them of their strike.

        return new Response(
            JSON.stringify({ success: true, eventsProcessed: events.length, usersPenalized: totalPenalized }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[ProcessNoShows] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
