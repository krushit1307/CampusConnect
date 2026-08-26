// =============================================================================
// Edge Function: Analyze Toxicity (Shadowban)
//  Issue: #3547 - Build an 'Interactive Real-Time Q&A Profanity/Troll Filter'
//  Issue: #4419 - Contextual AI for Violence Flag De-escalation
//  Description: Triggered via Database Webhook on qna_messages INSERT.
//  Analyzes the text using OpenAI Moderation API. When flagged for violence,
//  routes through Contextual AI to distinguish threats from slang before banning.
//  Sends a targeted WebSocket payload to the troll confirming receipt to
//  prevent circumvention.
//  =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.0";
import {
  requiresContextualAnalysis,
  analyzeContextually,
  logContextualAnalysis,
} from "../_shared/contextual-ai-analyzer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

/**
 * Determine if the moderation result corresponds to a violence-related category.
 */
function isViolenceFlag(categoryScores: Record<string, number>): boolean {
  const violenceScore = Math.max(
    categoryScores["violence"] || 0,
    categoryScores["violence/threatening"] || 0,
  );
  return violenceScore > 0.8;
}

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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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
    const categoryScores = result.category_scores || {};
    const toxicityScore = Math.max(categoryScores.harassment || 0, categoryScores.hate || 0);
    const isFlagged = result.flagged || toxicityScore > 0.8;
    const isViolence = isViolenceFlag(categoryScores);

    // ================================================================
    // Issue #4419: Contextual AI Analysis for Violence Flags
    // When ANY flagged message contains violence-related keywords,
    // route through contextual AI to check if it's slang/exaggeration
    // before shadowbanning. Previously this was gated on isViolence
    // which required OpenAI's violence score >0.8, causing messages
    // like "This exam killed me" (flagged as harassment, not violence)
    // to be banned without contextual review.
    // ================================================================
    if (isFlagged && requiresContextualAnalysis(text)) {
      const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiApiKey) {
        console.log(`[ContextualAI] Routing Q&A message ${messageId} for contextual analysis`);

        const flagReason = isViolence ? "violence" : "harassment/language";
        const contextResult = await analyzeContextually(text, openaiApiKey, flagReason);

        await logContextualAnalysis(supabaseAdmin, {
          message_id: messageId,
          user_id: userId,
          source_table: "qna_messages",
          original_flag_reason: flagReason,
          is_threat: contextResult.isThreat,
          confidence: contextResult.confidence,
          reasoning: contextResult.reasoning,
          original_content: text,
        });

        if (!contextResult.isThreat) {
          console.log(
            `[ContextualAI] Q&A message ${messageId} de-escalated: ${contextResult.reasoning}`,
          );

          // Not a threat - allow the message, but still log the score
          const { error: updateError } = await supabaseAdmin
            .from("qna_messages")
            .update({
              toxicity_score: toxicityScore,
              is_shadowbanned: false,
              is_flagged_for_review: false,
            })
            .eq("id", messageId);

          if (updateError) throw updateError;

          return new Response(
            JSON.stringify({
              success: true,
              toxicity_score: toxicityScore,
              shadowbanned: false,
              contextual_analysis: { de_escalated: true, reasoning: contextResult.reasoning },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
          );
        }

        console.log(`[ContextualAI] Q&A message ${messageId} confirmed as threat`);
      }
    }

    // 2. Update the message with toxicity score and shadowban status
    const { error: updateError } = await supabaseAdmin
      .from("qna_messages")
      .update({
        toxicity_score: toxicityScore,
        is_shadowbanned: isFlagged,
        is_flagged_for_review: isFlagged,
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
        type: "qna_confirmation",
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[AnalyzeToxicity] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
