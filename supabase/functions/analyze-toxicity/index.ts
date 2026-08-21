// =============================================================================
// Edge Function: Analyze Toxicity (Shadowban)
//  Issue: #3547 - Build an 'Interactive Real-Time Q&A Profanity/Troll Filter'
//  Description: Triggered via Database Webhook on qna_messages INSERT. 
//  Analyzes the text using OpenAI Moderation API. If toxicity > 0.8, flags 
//  the message as shadowbanned and updates the database. Sends a targeted 
//  WebSocket payload to the troll confirming receipt to prevent circumvention.
//  =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // Verify Webhook secret
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_WEBHOOK_SECRET")}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { record } = await req.json();
    if (!record || !record.content) {
        return new Response("Invalid payload", { status: 400 });
    }

    const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    try {
        const messageId = record.id;
        const userId = record.user_id;
        const text = record.content;

        // 1. Analyze with OpenAI Moderation API
        const moderation = await openai.moderations.create({
            input: text,
        });

        const result = moderation.results[0];
        const toxicityScore = result.category_scores?.harassment || result.category_scores?.hate || 0;
        const isFlagged = result.flagged || toxicityScore > 0.8;

        // 2. Update the message with toxicity score and shadowban status
        const { error: updateError } = await supabaseAdmin
            .from("qna_messages")
            .update({
                toxicity_score: toxicityScore,
                is_shadowbanned: isFlagged,
                is_flagged_for_review: isFlagged
            })
            .eq("id", messageId);

        if (updateError) throw updateError;

        // 3. If shadowbanned, send a fake "Success" notification ONLY to the troll
        // This prevents them from realizing they are blocked and creating alt accounts.
        if (isFlagged) {
            // We use Supabase Realtime custom payload to target the specific user's channel
            // Note: In a real app, you'd use a private channel or push notification
            await supabaseAdmin.from("notifications").insert({
                user_id: userId,
                title: "Question Submitted!",
                body: "Your question has been received and is in the queue.",
                is_read: false,
                type: "qna_confirmation"
            });

            // Optional: Flag the user's account for administrative review if repeat offender
            const { count } = await supabaseAdmin
                .from("qna_messages")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("is_shadowbanned", true);

            if ((count || 0) >= 3) {
                await supabaseAdmin.from("profiles").update({ is_suspended: true }).eq("id", userId);
            }
        }

        return new Response(
            JSON.stringify({ success: true, toxicity_score: toxicityScore, shadowbanned: isFlagged }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[AnalyzeToxicity] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
