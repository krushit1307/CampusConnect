// =============================================================================
// File: supabase/functions/wifi-telemetry-webhook/index.ts
// Issue: #4283 - Build a 'Real-Time "Event Capacity" Thermal Map'
// Description: Supabase Edge Function ingesting Cisco Meraki & Aruba WiFi Scanning
//              telemetry feeds and broadcasting crowd density updates.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MerakiScanningPayload {
  version: string;
  secret: string;
  type: "DevicesSeen" | "BluetoothDevicesSeen";
  data: {
    apMac: string;
    apTags?: string[];
    apFloors?: string[];
    observations: Array<{
      clientMac: string;
      ipv4?: string;
      rssi: number;
      seenTime: string;
    }>;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Handle Meraki Webhook Validation handshake
  if (req.method === "GET") {
    const validator = Deno.env.get("MERAKI_VALIDATOR_TOKEN") || "meraki_campus_validator_2026";
    return new Response(validator, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: MerakiScanningPayload = await req.json();
    const apMac = payload.data?.apMac;
    const deviceCount = payload.data?.observations?.length || 0;

    if (apMac) {
      // Ingest into database via RPC
      await supabaseClient.rpc("record_wifi_telemetry_rpc", {
        p_mac_address: apMac,
        p_connected_device_count: deviceCount,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        apMac,
        devicesObserved: deviceCount,
        timestamp: new Date().toISOString(),
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
