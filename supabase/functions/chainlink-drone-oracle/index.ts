import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * ============================================================================
 * CHAINLINK DRONE TELEMETRY ORACLE ADAPTER
 * ============================================================================
 *
 * DESCRIPTION:
 * This Edge Function serves as the deterministic data source for the Chainlink
 * Decentralized Oracle Network (DON). When the Polygon Smart Contract triggers
 * an SLA resolution, the Chainlink node pings this endpoint with the Delivery ID.
 * This endpoint verifies the IoT drone logs and returns the exact millisecond
 * timestamp of arrival, allowing the Smart Contract to execute the 10% slash.
 *
 * ============================================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Extract Delivery ID from URL path (e.g. /v1/drone-telemetry/DEL-8891)
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    const deliveryId = parts[parts.length - 1];

    if (!deliveryId) {
      throw new Error("Missing Delivery ID in path parameters.");
    }

    console.log(
      `[ORACLE ADAPTER] Incoming Request from Chainlink Node for Delivery ID: ${deliveryId}`,
    );

    // In a production environment, we would query the autonomous drone fleet database:
    // const { data } = await supabaseClient.from("drone_deliveries").select("arrival_time").eq("id", deliveryId).single();

    // For demonstration, we simulate fetching the drone telemetry logs.
    // Let's assume the drone arrived 5 minutes AFTER the SLA deadline.
    // SLA Deadline was: 2026-08-31T20:00:00Z
    // Arrival Time is:  2026-08-31T20:05:00Z

    const mockArrivalTimestamp = new Date("2026-08-31T20:05:00Z").getTime() / 1000; // Unix Epoch in Seconds

    const responsePayload = {
      data: {
        delivery_id: deliveryId,
        status: "DELIVERED",
        gps_coordinates: { lat: 42.3601, lng: -71.0589 },
        arrival_timestamp: mockArrivalTimestamp,
      },
    };

    console.log(
      `[ORACLE ADAPTER] Returning deterministic arrival timestamp: ${mockArrivalTimestamp}`,
    );

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("[ORACLE ADAPTER] Exception:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
