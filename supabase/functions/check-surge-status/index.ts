import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.30.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");

    if (!eventId) {
      throw new Error("eventId is required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("surge_config")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    let isSurgeActive = false;
    const surgeConfig = event.surge_config || { enabled: false, threshold: 10, multiplier: 1.2 };
    let salesVelocity = 0;

    if (surgeConfig.enabled) {
      const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
      const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
      if (redisUrl && redisToken) {
        try {
          const redis = new Redis({ url: redisUrl, token: redisToken });
          const now = Date.now();
          const oneMinuteAgo = now - 60000;
          const key = `sales_velocity:${eventId}`;

          // Clean up old entries
          await redis.zremrangebyscore(key, 0, oneMinuteAgo);
          // Get current count
          salesVelocity = await redis.zcard(key);

          if (salesVelocity >= surgeConfig.threshold) {
            isSurgeActive = true;
          }
        } catch (redisErr) {
          console.error("[Surge Check] Redis error:", redisErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        isSurgeActive,
        multiplier: isSurgeActive ? surgeConfig.multiplier : 1.0,
        salesVelocity,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
