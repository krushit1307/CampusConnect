// =============================================================================
// Edge Function: Chat Sentiment Shadowbanning
// Issue: #4838 - Automated "Profanity/Harassment" Chat Sentiment Shadowbanning
// Triggered via Database Webhook on event_chat_messages INSERT. Scores the
// message's sentiment, tracks a rolling average over the user's last 10
// messages, and silently shadowbans "vibe killers" who stay below -0.7 —
// no ban, no notice. Reuses the shadowban routing already built for #4221:
// profiles.is_shadowbanned is read by send_event_chat_message() on every
// future message, and the messageAdded subscription already hides
// is_shadowbanned messages from everyone except the author/admins.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scoreMessageSentiment, calculateRollingSentiment } from "../_shared/chatSentimentAnalyzer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLLING_WINDOW = 10;
const SHADOWBAN_THRESHOLD = -0.7;

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const webhookSecret = Deno.env.get("SUPABASE_WEBHOOK_SECRET");
  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await req.json();
    if (!payload || payload.type !== "INSERT" || payload.table !== "event_chat_messages") {
      return new Response(JSON.stringify({ message: "Ignored payload" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { id: messageId, content, user_id: userId } = payload.record;
    if (!content || !userId) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Score this message and persist it.
    const score = scoreMessageSentiment(content);
    await supabaseAdmin
      .from("event_chat_messages")
      .update({ sentiment_score: score })
      .eq("id", messageId);

    // 2. Pull the user's last 10 scored messages (most recent first).
    const { data: recentMessages } = await supabaseAdmin
      .from("event_chat_messages")
      .select("sentiment_score")
      .eq("user_id", userId)
      .not("sentiment_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(ROLLING_WINDOW);

    const scores = (recentMessages || []).map((m: { sentiment_score: number }) => m.sentiment_score);

    // Require a full window before judging someone's "vibe" — a single bad
    // message isn't the pattern we're after.
    if (scores.length < ROLLING_WINDOW) {
      return new Response(
        JSON.stringify({ success: true, score, rollingAverage: null, shadowbanned: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rollingAverage = calculateRollingSentiment(scores);
    let shadowbanned = false;

    if (rollingAverage < SHADOWBAN_THRESHOLD) {
      shadowbanned = true;

      // Silent shadowban — no ban notice, no message deletion. Future
      // messages are routed through the existing #4221 shadowban plumbing:
      // send_event_chat_message() stamps is_shadowbanned from this profile
      // flag, and the messageAdded subscription already hides those
      // messages from everyone but the author and admins/moderators.
      await supabaseAdmin.from("profiles").update({ is_shadowbanned: true }).eq("id", userId);

      await supabaseAdmin.from("shadowbanned_users").upsert({
        user_id: userId,
        reason: `Automated sentiment shadowban: rolling average ${rollingAverage} over last ${ROLLING_WINDOW} messages.`,
      });
    }

    return new Response(
      JSON.stringify({ success: true, score, rollingAverage, shadowbanned }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[chat-sentiment-shadowban] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

serve(handler);