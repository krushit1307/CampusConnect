// =============================================================================
// Edge Function: Execute Fiscal Rollover
// Issue: #4036 - Implement 'Automated Club Budget Roll-over' Logic
// Description: Cron-triggered function that iterates through all active clubs,
// calculates their allowable rollover (20% of initial allocation), and 
// automatically inserts a DEBIT transaction for the reclaimed amount.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Verify Cron Secret
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
    }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Fetch all active clubs with ledgers
    const { data: clubs, error: clubError } = await supabaseAdmin
      .from("clubs")
      .select("id, name")
      .eq("is_active", true);

    if (clubError) throw clubError;

    const results = [];
    let totalReclaimed = 0;

    // 2. Iterate and execute rollover RPC for each club
    for (const club of clubs || []) {
      const { data, error: rpcError } = await supabaseAdmin.rpc("execute_club_rollover", {
        p_club_id: club.id
      });

      if (rpcError) {
        console.error(`[Rollover] Failed for club ${club.id}:`, rpcError);
        continue;
      }

      if (data && data.length > 0) {
        const res = data[0];
        results.push({
          club_name: club.name,
          reclaimed: res.reclaimed_amount,
          new_balance: res.new_balance
        });
        totalReclaimed += Number(res.reclaimed_amount);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed_clubs: results.length, 
        total_reclaimed: totalReclaimed,
        details: results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("[ExecuteFiscalRollover] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
  }
});
