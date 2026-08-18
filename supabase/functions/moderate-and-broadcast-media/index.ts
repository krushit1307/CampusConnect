import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { event_id, user_id, media_url } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Check if user is shadowbanned
    const { data: shadowban } = await supabase
      .from("shadowbanned_users")
      .select("user_id")
      .eq("user_id", user_id)
      .single();

    if (shadowban) {
      // Silently accept but mark as rejected (shadowban treatment)
      await supabase.from("event_live_stream_media").insert({
        event_id,
        user_id,
        media_url,
        status: "rejected",
        moderation_reason: "Shadowbanned user",
      });
      return new Response(JSON.stringify({ status: "processed", approved: false }), { status: 200 });
    }

    // 2. Call AI Vision Moderation API
    const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image for explicit NSFW content, nudity, violence, or hate symbols. Respond strictly in JSON format: { \"is_safe\": boolean, \"reason\": string }.",
              },
              { type: "image_url", image_url: { url: media_url } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const visionResult = await visionResponse.json();
    const moderation = JSON.parse(visionResult.choices[0].message.content);

    if (!moderation.is_safe) {
      // 3. Reject media & Shadowban user
      await supabase.from("event_live_stream_media").insert({
        event_id,
        user_id,
        media_url,
        status: "rejected",
        moderation_reason: moderation.reason,
      });

      await supabase.from("shadowbanned_users").upsert({
        user_id,
        reason: `NSFW Upload Attempt: ${moderation.reason}`,
      });

      return new Response(JSON.stringify({ status: "rejected", reason: moderation.reason }), { status: 200 });
    }

    // 4. Approve media (Triggers Supabase Realtime broadcast to projector)
    const { data: mediaRecord } = await supabase
      .from("event_live_stream_media")
      .insert({
        event_id,
        user_id,
        media_url,
        status: "approved",
      })
      .select()
      .single();

    return new Response(JSON.stringify({ status: "approved", media: mediaRecord }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
