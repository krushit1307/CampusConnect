// =============================================================================
// File: supabase/functions/hardware-telemetry-ingest/index.ts
// Issue: #4304 - Build a 'Real-Time "Hardware Resource" Status Dashboard'
// Description: Edge Function ingesting real-time CloudWatch metrics & webhook alarms.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CloudWatchMetricPayload {
  instanceId: string;
  cpuUtilization: number;
  ramUsagePercent: number;
  networkOutKbps: number;
  anomalyScore?: number;
  sustainedMinutes?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: CloudWatchMetricPayload = await req.json();
    const isRogue =
      body.cpuUtilization >= 95.0 &&
      (body.sustainedMinutes ?? 0) >= 10 &&
      (body.networkOutKbps < 50 || (body.anomalyScore ?? 0) >= 0.75);

    // Update instance telemetry
    const { data, error } = await supabaseClient
      .from("hackathon_cloud_instances")
      .update({
        status: isRogue ? "critical_rogue_miner" : body.cpuUtilization > 80 ? "warning_high_load" : "healthy",
        is_rogue_miner_flagged: isRogue,
        sustained_high_cpu_minutes: body.sustainedMinutes ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("aws_instance_id", body.instanceId)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        instanceId: body.instanceId,
        isRogueMinerFlagged: isRogue,
        status: data?.status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
