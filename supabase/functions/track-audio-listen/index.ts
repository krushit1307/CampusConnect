import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Auth Header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { eventId, listenedSeconds = 30, completed = false } = await req.json();
    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Upsert the listen record
    // Since we have a unique constraint on (event_id, user_id), we can check first or just use a raw update.
    // Deno environment, we can just do a select then insert or update.

    const { data: existingRecord } = await supabase
      .from("event_audio_listens")
      .select("id, listened_seconds")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingRecord) {
      const { error: updateError } = await supabase
        .from("event_audio_listens")
        .update({
          listened_seconds: existingRecord.listened_seconds + listenedSeconds,
          completed: completed ? true : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRecord.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("event_audio_listens").insert({
        event_id: eventId,
        user_id: user.id,
        listened_seconds: listenedSeconds,
        completed: completed,
      });

      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
