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

  // Basic security check could be added here if needed, but since it's triggered by pg_cron
  // which runs in the DB, we might rely on network isolation or a secret token.
  try {
    // 1. Fetch all elements in the trending:events set with their scores
    // ZRANGE with WITHSCORES returns an array like ["event_uuid", "10", "another_uuid", "5.5"]
    const items = await redis.zrange("trending:events", 0, -1, { withScores: true });

    const pipeline = redis.pipeline();
    let processed = 0;

    // The Upstash Redis client returns objects or flat arrays depending on configuration.
    // Assuming standard flat array response for `withScores: true` -> [member, score, member, score]
    for (let i = 0; i < items.length; i += 2) {
      const member = items[i] as string;
      const score = Number(items[i + 1]);

      const newScore = score * 0.9;

      // Update score in pipeline
      pipeline.zadd("trending:events", { score: newScore, member });
      processed++;
    }

    if (processed > 0) {
      await pipeline.exec();
    }

    // 2. Remove negligible scores so stale events naturally disappear
    await redis.zremrangebyscore("trending:events", "-inf", 0.1);

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error decaying trending scores:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
