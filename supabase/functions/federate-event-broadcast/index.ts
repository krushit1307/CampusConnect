// supabase/functions/federate-event-broadcast/index.ts
// Broadcasts Cross-Campus Public events to trusted federated servers

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "Missing event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!event.is_federated_public) {
      return new Response(
        JSON.stringify({ error: "Event is not marked as federated public" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active federated servers
    const { data: servers, error: serverError } = await supabase
      .from("federated_servers")
      .select("*")
      .eq("is_active", true);

    if (serverError) {
      throw serverError;
    }

    const hostInstitution = Deno.env.get("CAMPUS_INSTITUTION_NAME") || "CampusConnect Host University";
    const originDomain = Deno.env.get("CAMPUS_DOMAIN") || req.headers.get("host") || "campusconnect.local";

    const payload = {
      origin_server_domain: originDomain,
      origin_event_id: event.id,
      title: event.title,
      description: event.description,
      start_time: event.start_time,
      end_time: event.end_time,
      location: event.location,
      banner_url: event.banner_url || event.image_url,
      host_institution: hostInstitution,
      federated_payload: {
        organizer_id: event.organizer_id,
        category: event.category,
        capacity: event.capacity,
        federated_at: new Date().toISOString(),
      },
    };

    const broadcastResults = [];

    for (const server of servers || []) {
      try {
        const targetUrl = `https://${server.domain}/functions/v1/federate-event-ingest`;
        const res = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Federation-Key": server.api_key_hash,
            "X-Origin-Domain": originDomain,
          },
          body: JSON.stringify(payload),
        });

        broadcastResults.push({
          domain: server.domain,
          status: res.status,
          success: res.ok,
        });
      } catch (err) {
        broadcastResults.push({
          domain: server.domain,
          error: (err as Error).message,
          success: false,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, broadcastResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
