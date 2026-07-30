// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Expecting payload from pg_net trigger on INSERT to chat_messages table
    if (payload.type !== "INSERT" || payload.table !== "chat_messages") {
      return new Response(JSON.stringify({ message: "Ignored: not a new chat message insert." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { id, content, sender_id, receiver_id } = payload.record;
    if (!content) {
      return new Response(JSON.stringify({ message: "No content to moderate." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.warn("Missing OPENAI_API_KEY environment variable. Moderation skipped.");
      return new Response(JSON.stringify({ error: "Missing OpenAI API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Call OpenAI Moderation endpoint
    const moderationRes = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        input: content,
      }),
    });

    if (!moderationRes.ok) {
      const errText = await moderationRes.text();
      throw new Error(`OpenAI Moderation API error: ${errText}`);
    }

    const moderationData = await moderationRes.json();
    const result = moderationData.results[0];

    // 2. If flagged for toxicity/hate-speech, hide and alert admins
    if (result.flagged) {
      console.log(`Flagging message ${id} due to detected toxicity.`);

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // A. Update chat_messages: set flagged columns and redact content
      const { error: updateError } = await supabase
        .from("chat_messages")
        .update({
          is_flagged: true,
          flagged_reason: "AI Moderation: Flagged for severe toxicity/hate speech.",
          content: "[This message has been hidden due to toxicity]",
        })
        .eq("id", id);

      if (updateError) {
        throw new Error(`Failed to update chat message flag: ${updateError.message}`);
      }

      // B. Retrieve admin IDs to alert
      const adminIds = new Set<string>();

      // Get system admins
      const { data: systemAdmins, error: sysAdminError } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "system_admin");

      if (!sysAdminError && systemAdmins) {
        systemAdmins.forEach((admin: any) => adminIds.add(admin.id));
      }

      // Get club admins of clubs where sender is a member
      const { data: memberships, error: membershipError } = await supabase
        .from("club_members")
        .select(`
          club_id,
          clubs:club_id (created_by)
        `)
        .eq("user_id", sender_id)
        .eq("status", "approved");

      if (!membershipError && memberships) {
        memberships.forEach((m: any) => {
          const clubCreator = m.clubs?.created_by;
          if (clubCreator) {
            adminIds.add(clubCreator);
          }
        });
      }

      // C. Send notifications to all unique admins
      const adminIdList = Array.from(adminIds);
      if (adminIdList.length > 0) {
        const notifications = adminIdList.map((adminId) => ({
          user_id: adminId,
          type: "reply",
          title: "Toxicity Alert",
          message: `A message from user ${sender_id} was automatically hidden due to severe toxicity/hate speech.`,
          link: "/admin/reports",
        }));

        const { error: notifyError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notifyError) {
          console.error("Failed to insert notification alerts:", notifyError);
        }
      }

      return new Response(
        JSON.stringify({
          flagged: true,
          message: "Message flagged, hidden, and administrators alerted.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ flagged: false, message: "Message is safe." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
