// =============================================================================
// Edge Function: Detect Event Clash
// Issue: #3708 - Implement 'Automated "Event Clash" Negotiation'
// Description: Runs when a draft is saved. Detects Tier-1 temporal + demographic
// clashes, pauses publishing, provisions a DM channel between the two club
// presidents and fires an urgent coordination alert.
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
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { event_id } = await req.json();
        if (!event_id) throw new Error("Missing event_id");

        // 1. Detect clashes
        const { data: clashes, error: rpcError } = await supabaseAdmin.rpc(
            "detect_event_clashes", { p_event_id: event_id }
        );
        if (rpcError) throw rpcError;

        if (!clashes || clashes.length === 0) {
            return new Response(JSON.stringify({ has_clash: false, clashes: [] }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
            });
        }

        // 2. Load the draft event + its club president
        const { data: draft } = await supabaseAdmin
            .from("events")
            .select("title, club_id, clubs(name)")
            .eq("id", event_id)
            .single();

        const clashResults: any[] = [];
        for (const clash of clashes) {
            // Record the clash
            const { data: clashRow } = await supabaseAdmin
                .from("event_clashes")
                .upsert({
                    event_a: event_id,
                    event_b: clash.other_event_id,
                    shared_members: clash.shared_members,
                    overlap_minutes: clash.overlap_minutes,
                    status: 'open',
                }, { onConflict: 'event_a,event_b' })
                .select()
                .single();

            // 3. Provision a negotiation DM channel between the two presidents
            const { data: presidentA } = await supabaseAdmin
                .from("club_members").select("user_id")
                .eq("club_id", draft.club_id).eq("role", "president").maybeSingle();
            const { data: otherClub } = await supabaseAdmin
                .from("events").select("club_id").eq("id", clash.other_event_id).single();
            const { data: presidentB } = await supabaseAdmin
                .from("club_members").select("user_id")
                .eq("club_id", otherClub.club_id).eq("role", "president").maybeSingle();

            let channelId: string | null = null;
            if (presidentA && presidentB) {
                const { data: channel } = await supabaseAdmin
                    .from("direct_message_channels")
                    .insert({ participant_a: presidentA.user_id, participant_b: presidentB.user_id })
                    .select().single();
                channelId = channel?.id ?? null;

                if (channelId) {
                    await supabaseAdmin.from("event_clashes")
                        .update({ negotiation_channel_id: channelId }).eq("id", clashRow.id);

                    // 4. Urgent coordination alert seeded into the channel
                    await supabaseAdmin.from("direct_messages").insert({
                        channel_id: channelId,
                        sender_id: null,
                        is_system: true,
                        content:
                            `⚠️ Warning: Your flagship events are clashing. ` +
                            `"${draft.title}" and "${clash.other_title}" overlap by ${clash.overlap_minutes} minutes ` +
                            `and you share ${clash.shared_members} members (${clash.overlap_pct}%). ` +
                            `We strongly suggest coordinating a schedule change.`,
                    });

                    // 5. Push notifications to both presidents
                    await supabaseAdmin.from("notifications").insert([
                        { user_id: presidentA.user_id, title: 'Event Clash Detected', body: `${draft.title} clashes with ${clash.other_title}.`, link: `/messages/${channelId}` },
                        { user_id: presidentB.user_id, title: 'Event Clash Detected', body: `${clash.other_title} clashes with ${draft.title}.`, link: `/messages/${channelId}` },
                    ]);
                }
            }

            clashResults.push({
                other_event_id: clash.other_event_id,
                other_title: clash.other_title,
                other_club_name: clash.other_club_name,
                shared_members: clash.shared_members,
                overlap_pct: clash.overlap_pct,
                overlap_minutes: clash.overlap_minutes,
                negotiation_channel_id: channelId,
            });
        }

        return new Response(JSON.stringify({ has_clash: true, clashes: clashResults }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
    } catch (error: any) {
        console.error("[DetectEventClash] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
