import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { getCloudProvider } from "../_shared/cloudProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Forbidden: Invalid authorization token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const cloudProvider = getCloudProvider();

    const now = new Date().toISOString();
    const { data: expiredRequests, error: reqError } = await supabaseAdmin
      .from("hardware_provisioning_requests")
      .select("id, status")
      .lt("event_end_time", now)
      .in("status", ["active", "provisioning", "partially_failed"]);

    if (reqError) throw reqError;
    const results = [];

    for (const request of expiredRequests) {
      try {
        await supabaseAdmin
          .from("hardware_provisioning_requests")
          .update({ status: "terminating" })
          .eq("id", request.id);

        const { data: resources } = await supabaseAdmin
          .from("hardware_provisioned_resources")
          .select("id, provider_resource_id")
          .eq("request_id", request.id)
          .in("status", ["active", "provisioning"]);

        if (resources && resources.length > 0) {
          const instanceIds = resources.map((r: any) => r.provider_resource_id).filter(Boolean);
          if (instanceIds.length > 0) {
            await cloudProvider.terminateInstances(instanceIds);
          }
          await supabaseAdmin
            .from("hardware_provisioned_resources")
            .update({ status: "terminated" })
            .eq("request_id", request.id);
        }

        await supabaseAdmin
          .from("hardware_provisioning_requests")
          .update({ status: "terminated" })
          .eq("id", request.id);
        results.push({ id: request.id, status: "success" });
      } catch (err: any) {
        console.error(`Failed to terminate request ${request.id}:`, err);
        await supabaseAdmin
          .from("hardware_provisioning_requests")
          .update({ status: "failed", error_information: err.message })
          .eq("id", request.id);
        results.push({ id: request.id, status: "failed", error: err.message });
      }
    }
    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
