import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Auth Header");
    const {
      data: { user },
      error: authErr,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const { vendor_id, contract_date } = await req.json();
    if (!vendor_id) throw new Error("vendor_id is required");

    // In a real scenario, we'd query Polygon RPC and Supabase for IoT and CV Logs.
    // For this demonstration, we mock the blockchain retrieval process.

    // Simulate RPC Latency
    await new Promise((r) => setTimeout(r, 1500));

    // Mock Blockchain Transaction Hash linking to the on-chain IPFS Merkle Root
    const polygon_tx_hash =
      "0x" +
      Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    const cv_spoilage_hash =
      "sha256:" +
      Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    const auditData = {
      vendor_id,
      contract_date: contract_date || new Date().toISOString(),
      blockchain_verification: {
        network: "Polygon Mainnet",
        contract_address: "0x892aF0f6EbD3Bc40C4d29311B9a83B32dE28E951",
        transaction_hash: polygon_tx_hash,
        cv_hash: cv_spoilage_hash,
      },
      iot_temperature_logs: [
        { timestamp: "2026-08-31T08:00:00Z", temp_f: 38.2, status: "COMPLIANT" },
        { timestamp: "2026-08-31T09:00:00Z", temp_f: 38.5, status: "COMPLIANT" },
        { timestamp: "2026-08-31T10:00:00Z", temp_f: 41.5, status: "WARNING" },
        { timestamp: "2026-08-31T10:15:00Z", temp_f: 39.0, status: "COMPLIANT" },
        { timestamp: "2026-08-31T11:00:00Z", temp_f: 37.8, status: "COMPLIANT" },
      ],
      computer_vision_logs: [
        {
          timestamp: "2026-08-31T10:05:00Z",
          camera: "Kitchen Cam 1",
          event: "Food Spoilage Detected",
          action: "Flagged for Disposal",
          confidence: 0.98,
        },
      ],
    };

    // Log the audit generation in Postgres for internal tracking
    await supabaseClient.from("fda_haccp_audit_logs").insert({
      vendor_id,
      generated_by: user.id,
      polygon_tx_hash,
      cv_spoilage_hash,
    });

    return new Response(
      JSON.stringify({
        success: true,
        payload: auditData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
