import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { redis } from "../_shared/redis.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id, action } = await req.json();

    if (!event_id || !action) {
      return new Response(JSON.stringify({ error: "Missing event_id or action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let scoreToAdd = 0;
    if (action === "rsvp") {
      scoreToAdd = 5;
    } else if (action === "comment") {
      scoreToAdd = 2;
    } else if (action === "like") {
      scoreToAdd = 1;
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment the trending score for the event
    await redis.zincrby("trending:events", scoreToAdd, event_id);

    return new Response(JSON.stringify({ success: true, score_added: scoreToAdd, event_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error updating trending score:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
