import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST is required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey)
    return json({ error: "Server configuration is incomplete" }, 500);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Authorization is required" }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authorization } },
  });

  const body = await request.json().catch(() => ({}));
  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  const weatherModifier = typeof body.weather_modifier === "number" ? body.weather_modifier : 0;
  if (!eventId) return json({ error: "event_id is required" }, 400);

  const { data, error } = await supabase.rpc("predict_event_churn", {
    p_event_id: eventId,
    p_weather_modifier: Math.max(-0.5, Math.min(0.75, weatherModifier)),
  });

  if (error) {
    console.error("[predict-event-churn] prediction failed", error);
    return json({ error: error.message }, error.code === "42501" ? 403 : 500);
  }

  return json(data);
});
