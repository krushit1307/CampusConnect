// =============================================================================
// Edge Function: Live Chat Moderation & Auto-Ban
// Issue: #4221 - Automated "Profanity/Harassment" Auto-Ban
// Description: Triggered via Database Webhook on event_chat_messages INSERT.
// Analyzes content via OpenAI Moderations API and local wordlists.
// Deletes toxic messages, increments violation strikes, and auto-shadowbans.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROFANITY_LIST = [
  "fuck", "shit", "cunt", "nigger", "faggot", "bitch", "asshole",
  "dickhead", "motherfucker", "cock", "pussy", "retard", "tranny",
  "chink", "kike", "wetback", "abuse", "toxic", "hate", "harass", "slur"
];

const BYPASS_PATTERNS = [
  /\b[f][\W_]*[u][\W_]*[c][\W_]*[k]\b/i,
  /\b[s][\W_]*[h][\W_]*[i][\W_]*[t]\b/i,
  /\b[n][\W_]*[i][\W_]*[g][\W_]*[g][\W_]*[e][\W_]*[r]\b/i,
  /\b[f][\W_]*[a][\W_]*[g][\W_]*[g][\W_]*[o][\W_]*[t]\b/i
];

function checkLocalProfanity(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  // 1. Exact match against profanity list
  const words = lower.split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    if (PROFANITY_LIST.includes(cleanWord)) {
      return true;
    }
  }

  // 2. Bypass regex patterns
  for (const pattern of BYPASS_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify Webhook secret if configured
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

    const { id: messageId, content, user_id: userId, event_id: eventId } = payload.record;
    if (!content || !userId) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let isToxic = false;
    let toxicityScore = 0;

    // 1. Run local word boundary check
    const isLocalProfane = checkLocalProfanity(content);
    if (isLocalProfane) {
      isToxic = true;
      toxicityScore = 1.0;
    }

    // 2. Run OpenAI Moderation check if API key exists
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!isToxic && openaiApiKey) {
      const moderationRes = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({ input: content }),
      });

      if (moderationRes.ok) {
        const modData = await moderationRes.json();
        const result = modData.results[0];
        const scores = result.category_scores || {};
        const score = Math.max(
          scores.harassment || 0,
          scores["harassment/threatening"] || 0,
          scores.hate || 0,
          scores["hate/threatening"] || 0
        );

        if (result.flagged || score > 0.9) {
          isToxic = true;
          toxicityScore = score;
        }
      }
    }

    if (isToxic) {
      console.log(`Flagging chat message ${messageId} as toxic (${toxicityScore})`);

      // A. Silently delete the message
      const { error: deleteError } = await supabaseAdmin
        .from("event_chat_messages")
        .delete()
        .eq("id", messageId);
      
      if (deleteError) throw deleteError;

      // B. Increment strikes on user profile
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("violation_strikes")
        .eq("id", userId)
        .single();
      
      const newStrikes = (profile?.violation_strikes || 0) + 1;
      await supabaseAdmin
        .from("profiles")
        .update({ violation_strikes: newStrikes })
        .eq("id", userId);

      // C. Log strike inside moderation_flags
      await supabaseAdmin
        .from("moderation_flags")
        .insert({
          user_id: userId,
          violation_type: "chat_moderation",
          flagged_content: content,
        });

      // D. Check 1-hour rolling strikes
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { count } = await supabaseAdmin
        .from("moderation_flags")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("violation_type", "chat_moderation")
        .gte("created_at", oneHourAgo);

      let shadowbanned = false;
      if ((count || 0) >= 3) {
        shadowbanned = true;
        // Global shadowban update
        await supabaseAdmin
          .from("profiles")
          .update({ is_shadowbanned: true })
          .eq("id", userId);

        await supabaseAdmin
          .from("shadowbanned_users")
          .upsert({
            user_id: userId,
            reason: "Automated auto-ban: 3 chat violations in 1 hour.",
          });
      }

      // E. Alert Student Union Admins (system_admin role)
      const { data: admins } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "system_admin");

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin: any) => ({
          user_id: admin.id,
          type: "reply",
          title: "Troll Auto-Ban Alert",
          message: `User ${userId} has been auto-shadowbanned for repeated harassment in Live Event Chat.`,
          link: "/admin/reports",
        }));
        await supabaseAdmin.from("notifications").insert(notifications);
      }

      return new Response(
        JSON.stringify({ success: true, toxic: true, shadowbanned }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, toxic: false, shadowbanned: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[live-chat-moderation] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

serve(handler);
