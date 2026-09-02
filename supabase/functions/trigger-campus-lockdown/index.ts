import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Get the user from the authorization header
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Ensure the user has the right role (Campus Police / Admin) - For this mock, we assume they do if they can access the dashboard.
    // Parse the payload
    const { action, zone_id } = await req.json();

    if (!action || !zone_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: action, zone_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (action !== "LOCKDOWN" && action !== "UNLOCK") {
      return new Response(JSON.stringify({ error: "Invalid action. Must be LOCKDOWN or UNLOCK" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // --- SIMULATED PHYSICAL SECURITY API INTEGRATION ---
    // In a real scenario, this is where we would establish a secure tunnel and make a POST request to LenelS2 or Brivo API.
    // e.g. await fetch('https://physical-security.university.edu/api/v1/zones/lockdown', { ... })

    console.log(
      `[PHYSICAL SECURITY MOCK] Action: ${action} triggered for Zone: ${zone_id} by User: ${user.id}`,
    );

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully executed ${action} for ${zone_id}`,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error("Error triggering lockdown:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
