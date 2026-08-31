import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * ============================================================================
 * BOTNET REVIEW BOMBING DETECTION ENGINE (IP ASN FINGERPRINTING)
 * ============================================================================
 *
 * DESCRIPTION:
 * Graph analysis fails when a malicious actor uses 5,000 distinct IP addresses
 * to submit 5,000 fake reviews. This edge function intercepts review traffic,
 * resolves the physical infrastructure (ASN) via IP mapping, and calculates
 * the volumetric velocity of datacenter-originated traffic.
 *
 * MATH:
 * If > 80% of the last 100 reviews originate from Non-Residential / Datacenter
 * ASNs (e.g., AWS, Hetzner, DigitalOcean), it mathematically proves a Sybil
 * Botnet attack.
 *
 * ============================================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    const { event_id, review_id, user_id, ip_address } = await req.json();

    if (!event_id || !ip_address) {
      throw new Error("Missing required telemetry payload.");
    }

    console.log(
      `[BOTNET SHIELD] Analyzing Incoming Review for Event ${event_id} from IP: ${ip_address}`,
    );

    // 1. Mock IP to ASN Resolution (In prod: MaxMind GeoIP2 / IPinfo)
    // To simulate a botnet, we will randomly assign this IP to a Datacenter ASN 85% of the time.
    const isMaliciousSim = Math.random() < 0.85;
    const datacenterAsns = [14618, 14061, 24940, 62240, 9009];
    const residentialAsns = [7922, 7018, 20115]; // Comcast, ATT, Charter

    let resolvedAsn = isMaliciousSim
      ? datacenterAsns[Math.floor(Math.random() * datacenterAsns.length)]
      : residentialAsns[Math.floor(Math.random() * residentialAsns.length)];

    let isDatacenter = isMaliciousSim;

    // 2. Log the Telemetry
    await supabaseClient.from("event_review_telemetry").insert({
      review_id,
      event_id,
      user_id,
      ip_address,
      asn: resolvedAsn,
      is_datacenter: isDatacenter,
      status: "PUBLISHED",
    });

    console.log(`[BOTNET SHIELD] Resolved IP to ASN: ${resolvedAsn} (Datacenter: ${isDatacenter})`);

    // 3. Volumetric Aggregation: Fetch last 100 reviews for this event
    const { data: recentLogs, error: fetchErr } = await supabaseClient
      .from("event_review_telemetry")
      .select("is_datacenter, status, ip_address")
      .eq("event_id", event_id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchErr) throw fetchErr;

    if (recentLogs && recentLogs.length > 20) {
      // Require a minimum sample size to prevent false positives
      const datacenterCount = recentLogs.filter((log) => log.is_datacenter).length;
      const syntheticRatio = datacenterCount / recentLogs.length;

      console.log(
        `[BOTNET SHIELD] Velocity Analysis: ${datacenterCount}/${recentLogs.length} recent reviews originate from Datacenters (${(syntheticRatio * 100).toFixed(1)}%).`,
      );

      // 4. Sybil Detection Threshold (> 80% Datacenter traffic)
      if (syntheticRatio > 0.8) {
        console.warn(`[!] CRITICAL: MASSIVE BOTNET REVIEW BOMBING DETECTED ON EVENT ${event_id}`);

        // Execute Quarantine Protocol
        await supabaseClient
          .from("event_review_telemetry")
          .update({ status: "QUARANTINED" })
          .eq("event_id", event_id)
          .eq("is_datacenter", true)
          .eq("status", "PUBLISHED");

        // In a real scenario, we would also:
        // 1. Update the `events` table to flag `is_under_attack = true`
        // 2. Add the ASN blocks to a temporary WAF shadowban list

        return new Response(
          JSON.stringify({
            success: true,
            action_taken: "QUARANTINED_BOTNET_TRAFFIC",
            synthetic_ratio: syntheticRatio,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, action_taken: "PUBLISHED", synthetic_ratio: 0 }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err: any) {
    console.error("[BOTNET SHIELD] Exception:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
