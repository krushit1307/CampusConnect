// supabase/functions/federate-event-ingest/index.ts
// Ingestion endpoint on Peer Campus (e.g. University B) receiving federated events

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-federation-key, x-origin-domain",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const federationKey = req.headers.get("x-federation-key");
    const originDomain = req.headers.get("x-origin-domain");

    if (!federationKey || !originDomain) {
      return new Response(
        JSON.stringify({ error: "Missing federation authentication headers" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify origin domain is registered as trusted server
    const { data: server, error: serverError } = await supabase
      .from("federated_servers")
      .select("*")
      .eq("domain", originDomain)
      .eq("is_active", true)
      .single();

    if (serverError || !server) {
      return new Response(
        JSON.stringify({ error: "Unauthorized peer campus server" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    const {
      origin_event_id,
      title,
      description,
      start_time,
      end_time,
      location,
      banner_url,
      host_institution,
      federated_payload,
    } = payload;

    if (!origin_event_id || !title || !start_time) {
      return new Response(
        JSON.stringify({ error: "Invalid event payload format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert into remote_events
    const { data: remoteEvent, error: upsertError } = await supabase
      .from("remote_events")
      .upsert(
        {
          origin_server_domain: originDomain,
          origin_event_id,
          title,
          description: description || null,
          start_time,
          end_time: end_time || null,
          location: location || null,
          banner_url: banner_url || null,
          host_institution: host_institution || server.institution_name,
          federated_payload: federated_payload || {},
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "origin_server_domain,origin_event_id",
        }
      )
      .select()
      .single();

    if (upsertError) {
      throw upsertError;
    }

    return new Response(
      JSON.stringify({ success: true, remote_event: remoteEvent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
