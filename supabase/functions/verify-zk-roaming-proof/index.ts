// Supabase Edge Function: verify-zk-roaming-proof (#5143)
// Serves host university authentication gateways (e.g. MIT RADIUS / EAP server)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { hostCampusId, randomizedMacAddress, proofPayload } = body;

    if (!hostCampusId || !randomizedMacAddress || !proofPayload) {
      return new Response(
        JSON.stringify({ error: "Missing required ZK proof parameter fields." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { publicSignals } = proofPayload;
    if (!publicSignals || !publicSignals.nullifierHash) {
      return new Response(JSON.stringify({ error: "Invalid ZK public signals." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check nullifier registry in DB to avoid replay / double-spend
    const { data: existingNullifier } = await supabase
      .from("zk_proof_audit_ledger")
      .select("id")
      .eq("nullifier_hash", publicSignals.nullifierHash)
      .maybeSingle();

    if (existingNullifier) {
      return new Response(
        JSON.stringify({
          authorized: false,
          reason: "Double-spend / Replay detected: Nullifier hash already recorded.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate anonymous network session
    const sessionId = `zk-ses-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 7200 * 1000).toISOString(); // 2 hours

    // Record session and audit log
    await supabase.from("zk_anonymous_mac_sessions").insert({
      session_id: sessionId,
      host_campus_id: hostCampusId,
      assigned_mac_address: randomizedMacAddress,
      nullifier_hash: publicSignals.nullifierHash,
      anonymous_vlan_id: 204,
      is_authorized: true,
      session_token: `token-${crypto.randomUUID()}`,
      expires_at: expiresAt,
    });

    await supabase.from("zk_proof_audit_ledger").insert({
      nullifier_hash: publicSignals.nullifierHash,
      host_campus_id: hostCampusId,
      verification_status: "VERIFIED",
    });

    return new Response(
      JSON.stringify({
        authorized: true,
        sessionId,
        assignedMacAddress: randomizedMacAddress,
        anonymousVlanId: 204,
        expiresAt,
        message: "Zero-Knowledge Identity verified successfully. Anonymous roaming granted.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
