// =============================================================================
// Edge Function: Create Networking Match
// Issue: #3697 - Develop a 'Dynamic "Blind Networking" Matchmaker'
// Description: Runs the cross-discipline matching RPC, then provisions a secure
// DM channel and seeds it with an introductory bot message + 3 icebreakers.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        // Admin client used only to provision the DM channel + bot message rows
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Run the transactional matcher (enforces different-major constraint)
        const { data: matchId, error: rpcError } = await supabase.rpc(
            "create_blind_networking_match",
            { p_user_id: user.id }
        );
        if (rpcError) throw rpcError;

        if (!matchId) {
            return new Response(
                JSON.stringify({ success: false, reason: "no_eligible_partner" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        // 2. Load the freshly created match + both profiles
        const { data: match } = await supabaseAdmin
            .from("networking_matches")
            .select("id, user_a, user_b, icebreakers")
            .eq("id", matchId)
            .single();

        const partnerId = match.user_a === user.id ? match.user_b : match.user_a;
        const { data: partner } = await supabaseAdmin
            .from("profiles")
            .select("full_name, major")
            .eq("id", partnerId)
            .single();

        // 3. Provision a secure DM channel between the two users
        const { data: channel } = await supabaseAdmin
            .from("direct_message_channels")
            .insert({ participant_a: match.user_a, participant_b: match.user_b })
            .select()
            .single();

        if (channel) {
            await supabaseAdmin
                .from("networking_matches")
                .update({ channel_id: channel.id })
                .eq("id", matchId);

            // 4. Seed the introductory bot message with icebreakers
            const icebreakerList = (match.icebreakers || [])
                .map((s: string, i: number) => `${i + 1}. ${s}`)
                .join("\n");

            await supabaseAdmin.from("direct_messages").insert({
                channel_id: channel.id,
                sender_id: null, // null sender = system bot
                content:
                    `Meet ${partner?.full_name || "your match"}! They are a ` +
                    `${partner?.major || "fellow"} major. Here are 3 icebreakers to get you started:\n\n` +
                    icebreakerList,
                is_system: true,
            });
        }

        return new Response(
            JSON.stringify({
                success: true,
                match_id: matchId,
                partner_name: partner?.full_name,
                partner_major: partner?.major,
                icebreakers: match.icebreakers,
                channel_id: channel?.id,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
    } catch (error: any) {
        console.error("[CreateNetworkingMatch] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
