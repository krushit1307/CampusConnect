// Supabase Edge Function: /api/admin/metrics/mau
// Returns rolling 30-day MAU metrics from mau_materialized_view

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = performance.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase
      .from("mau_materialized_view")
      .select("date, mau")
      .order("date", { ascending: true });

    if (error) {
      throw error;
    }

    const durationMs = performance.now() - startTime;

    return new Response(
      JSON.stringify({
        data: data || [],
        count: data?.length || 0,
        executionTimeMs: Math.round(durationMs * 100) / 100,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Execution-Time-Ms": String(Math.round(durationMs * 100) / 100),
        },
      },
    );
  } catch (err) {
    console.error("[admin-mau-metrics] Error querying materialized view:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Database query failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
