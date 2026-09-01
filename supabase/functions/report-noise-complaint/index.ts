// Edge Function: Report Noise Complaint
// Description: Dynamic noise complaint router that handles incoming user GPS telemetry and triggers push notifications.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { latitude, longitude } = await req.json();
    if (latitude === undefined || longitude === undefined) {
      throw new Error("Latitude and Longitude coordinates are required.");
    }

    // Call the database function to submit and route the noise complaint
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("submit_noise_complaint", {
      p_reporter_id: user.id,
      p_latitude: Number(latitude),
      p_longitude: Number(longitude),
    });

    if (rpcError) throw rpcError;

    if (!result.success) {
      return new Response(JSON.stringify({ success: false, error: result.error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // If >= 3 complaints hit within 15 minutes, trigger the aggressive push notification
    if (result.complaint_count >= 3 && result.organizer_id) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_id: result.organizer_id,
            title: "🚨 URGENT: Noise Complaint Alert",
            message: `URGENT: 3 Noise Complaints from nearby dorms. Turn down the music immediately or Campus Police will be dispatched.`,
            priority: "emergency",
          }),
        });
      } catch (err: any) {
        console.error("Failed to send aggressive push notification:", err.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: result.event_id,
        event_title: result.event_title,
        complaint_count: result.complaint_count,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("Report Noise Complaint Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
