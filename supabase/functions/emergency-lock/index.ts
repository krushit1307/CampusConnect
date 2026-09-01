import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { limitRate } from "../shared/rate_limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Emergency Lock — locks the escrow ledger on a critical continuous-auth
 * anomaly (snatch, struggle, device theft). Persists a safety alert audit
 * record server-side (client-side RPC is intentionally limited so a malicious
 * client cannot trivially spam unlocks / forge alerts without a valid token).
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate limit to prevent abuse (10 lock triggers / min)
  const rateLimitResponse = await limitRate(req, "emergency-lock", {
    limit: 10,
    windowMs: 60000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let user;
  try {
    user = await verifyAuth(req, supabase);
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { reason, confidence, sensorSnapshot, duressFlag } = await req.json();

    if (!reason) {
      return new Response(JSON.stringify({ error: "Missing reason" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = req.headers.get("user-agent") ?? null;

    // 1. Lock the escrow ledger
    const { data: lock, error: lockError } = await supabase.rpc("lock_user_escrow", {
      p_user_id: user.id,
      p_reason: reason,
      p_duress_flag: duressFlag ?? false,
    });

    if (lockError) throw lockError;

    // 2. Record a safety alert audit record
    const { error: alertError } = await supabase.rpc("record_safety_alert", {
      p_user_id: user.id,
      p_alert_type: reason,
      p_confidence_score: confidence ?? null,
      p_sensor_snapshot: sensorSnapshot ?? null,
      p_locked_escrow: true,
      p_duress_indicated: duressFlag ?? false,
      p_ip_address: ip,
      p_user_agent: userAgent,
    });

    if (alertError) throw alertError;

    return new Response(JSON.stringify({ success: true, lock }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Emergency lock error:", error);
    return new Response(JSON.stringify({ error: "Failed to lock escrow" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
