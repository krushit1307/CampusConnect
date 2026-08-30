// =============================================================================
// Edge Function: Verify Zone Access
// Issue: #4047 - Develop a 'Dynamic "VIP/Sponsor" Access Control'
// Description: Validates a scanned ticket against a specific access zone, 
// returning a detailed result including the user's tier and a reject reason 
// if their tier is insufficient for the zone.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIER_HIERARCHY: Record<string, number> = {
    general: 1,
    vip: 2,
    sponsor: 3,
    staff: 4,
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { ticket_id, zone_id } = await req.json();
        if (!ticket_id || !zone_id) throw new Error("Missing ticket_id or zone_id");

        // 1. Fetch zone requirements
        const { data: zone, error: zoneErr } = await supabaseAdmin
            .from("access_zones")
            .select("name, min_required_tier, event_id")
            .eq("id", zone_id)
            .single();

        if (zoneErr || !zone) throw new Error("Invalid access zone");

        // 2. Fetch ticket details
        const { data: ticket, error: ticketErr } = await supabaseAdmin
            .from("tickets")
            .select("tier, user_id, profiles(full_name, avatar_url), event_id")
            .eq("id", ticket_id)
            .single();

        if (ticketErr || !ticket) throw new Error("Invalid or expired ticket");

        if (ticket.event_id !== zone.event_id) {
            throw new Error("Ticket does not belong to this event");
        }

        // 3. Evaluate access
        const userTierLevel = TIER_HIERARCHY[ticket.tier] || 0;
        const requiredTierLevel = TIER_HIERARCHY[zone.min_required_tier] || 0;
        const isAuthorized = userTierLevel >= requiredTierLevel;

        return new Response(
            JSON.stringify({
                authorized: isAuthorized,
                ticket: {
                    tier: ticket.tier,
                    user_name: (ticket.profiles as any)?.full_name || "Unknown",
                    avatar_url: (ticket.profiles as any)?.avatar_url,
                },
                zone_name: zone.name,
                required_tier: zone.min_required_tier,
                reject_reason: isAuthorized ? null : `Insufficient Access Level (Requires ${zone.min_required_tier.toUpperCase()})`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
    } catch (error: any) {
        console.error("[VerifyZoneAccess] Error:", error);
        return new Response(
            JSON.stringify({ authorized: false, reject_reason: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
});
