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

    // Verify auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { eventId, hasRsvpd, action } = await req.json();
    if (!eventId || !action) {
      return new Response(JSON.stringify({ error: "Missing eventId or action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookup remote event
    const { data: remoteEvent, error: eventError } = await supabase
      .from("remote_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !remoteEvent) {
      return new Response(JSON.stringify({ error: "Remote event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookup trusted federated server config for origin domain
    const { data: server, error: serverError } = await supabase
      .from("federated_servers")
      .select("*")
      .eq("domain", remoteEvent.origin_server_domain)
      .eq("is_active", true)
      .single();

    if (serverError || !server) {
      return new Response(JSON.stringify({ error: "Untrusted or inactive federated server" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Proxy the request to the origin campus
    const targetUrl = `https://${remoteEvent.origin_server_domain}/functions/v1/federate-rsvp-handler`;
    const localDomain = Deno.env.get("CAMPUS_DOMAIN") || "campusconnect.local";

    const s2sPayload = {
      origin_event_id: remoteEvent.origin_event_id,
      user_email: user.email,
      user_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "External Student",
      user_role: user.user_metadata?.role || "student",
      action,
      hasRsvpd,
    };

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Federation-Key": server.api_key_hash,
        "X-Origin-Domain": localDomain,
      },
      body: JSON.stringify(s2sPayload),
    });

    const result = await response.json();

    if (response.ok && action === "toggle" && result.success) {
      if (hasRsvpd) {
        // Cancel local reference
        await supabase
          .from("remote_event_rsvps")
          .delete()
          .match({ remote_event_id: eventId, user_id: user.id });
      } else {
        // Save local reference
        await supabase
          .from("remote_event_rsvps")
          .upsert({
            remote_event_id: eventId,
            user_id: user.id,
          });
      }
    }

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
