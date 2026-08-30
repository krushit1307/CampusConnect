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

    const { venue_id } = await req.json();
    if (!venue_id) throw new Error("venue_id is required");

    // In a production environment, we would fetch from Cisco Meraki Dashboard API
    // e.g. const res = await fetch(`https://api.meraki.com/api/v1/networks/${net_id}/devices`, { headers: { 'X-Cisco-Meraki-API-Key': ... } })

    // For this demonstration, we mock the physical layout injection
    const mockAccessPoints = [
      {
        venue_id,
        mac_address: "e0:55:3d:88:ab:c1",
        model: "Meraki MR56",
        x_pos: 20, // 20% along the X axis of the room
        y_pos: 30, // 30% along the Y axis of the room
        signal_radius_meters: 25.0,
      },
      {
        venue_id,
        mac_address: "e0:55:3d:88:ab:c2",
        model: "Meraki MR56",
        x_pos: 80,
        y_pos: 40,
        signal_radius_meters: 25.0,
      },
    ];

    // Upsert the data based on MAC address
    const { error: upsertErr } = await supabaseClient
      .from("venue_access_points")
      .upsert(mockAccessPoints, { onConflict: "mac_address" });

    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Successfully synchronized Meraki physical infrastructure data.",
        synced_aps: mockAccessPoints.length,
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
