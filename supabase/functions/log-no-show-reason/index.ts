// =============================================================================
// Edge Function: Log No-Show Reason
//  Issue: #3563 - Implement 'Automated Post-Event "No-Show" Feedback Loop'
//  Description: Handles the GET requests from 1-click email links. Extracts
//  the event_id, user_id, and reason from the URL parameters, logs the data
//  securely via RPC, and redirects the user to a simple "Thanks" page.
//  =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle both GET (from email links) and POST (from in-app forms)
    const url = new URL(req.url);
    const isGet = req.method === "GET";

    let eventId, userId, reason, feedback;

    if (isGet) {
        eventId = url.searchParams.get("event_id");
        userId = url.searchParams.get("user_id");
        reason = url.searchParams.get("reason");
        feedback = url.searchParams.get("feedback");
    } else if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    } else {
        const body = await req.json();
        eventId = body.event_id;
        userId = body.user_id;
        reason = body.reason;
        feedback = body.feedback;
    }

    const appUrl = Deno.env.get("APP_URL") || "https://campusconnect.app";

    // Validate required parameters
    if (!eventId || !userId || !reason) {
        if (isGet) {
            return new Response(null, {
                status: 302,
                headers: { Location: `${appUrl}/feedback/error?message=missing_params` }
            });
        }
        return new Response(JSON.stringify({ error: "Missing required parameters" }), { headers: corsHeaders, status: 400 });
    }

    const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    try {
        // 1. Verify the user was actually a no-show for this event
        const { data: rsvp, error: rsvpError } = await supabaseAdmin
            .from("event_rsvps")
            .select("status, checked_in")
            .eq("event_id", eventId)
            .eq("user_id", userId)
            .maybeSingle();

        if (rsvpError) throw rsvpError;

        // Allow logging if they were registered but didn't check in, or if they already logged a reason
        if (!rsvp || (rsvp.status !== "registered" && rsvp.status !== "no_show")) {
            if (isGet) {
                return new Response(null, {
                    status: 302,
                    headers: { Location: `${appUrl}/feedback/error?message=invalid_rsvp` }
                });
            }
            return new Response(JSON.stringify({ error: "User was not a no-show for this event" }), { headers: corsHeaders, status: 400 });
        }

        // 2. Log the reason via RPC
        const { error: rpcError } = await supabaseAdmin.rpc("log_no_show_reason", {
            p_event_id: eventId,
            p_user_id: userId,
            p_reason: reason,
            p_feedback: feedback || null
        });

        if (rpcError) throw rpcError;

        // 3. Redirect to success page (for GET requests) or return success JSON
        if (isGet) {
            return new Response(null, {
                status: 302,
                headers: { Location: `${appUrl}/feedback/thanks` }
            });
        }

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[LogNoShowReason] Error:", error);

        if (isGet) {
            return new Response(null, {
                status: 302,
                headers: { Location: `${appUrl}/feedback/error?message=server_error` }
            });
        }

        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
