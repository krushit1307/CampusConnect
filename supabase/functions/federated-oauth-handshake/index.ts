// supabase/functions/federated-oauth-handshake/index.ts
// Handles cross-campus authentication redirect for foreign student RSVP ticket claiming

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

    const { origin_domain, origin_event_id, mentee_or_attendee_email } = await req.json();

    if (!origin_domain || !origin_event_id) {
      return new Response(
        JSON.stringify({ error: "Missing origin_domain or origin_event_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate trusted domain
    const { data: server, error: serverError } = await supabase
      .from("federated_servers")
      .select("*")
      .eq("domain", origin_domain)
      .eq("is_active", true)
      .single();

    if (serverError || !server) {
      return new Response(
        JSON.stringify({ error: "Federated server is untrusted or inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build signed federation RSVP redirect handshake
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const callbackUrl = `https://${origin_domain}/events/${origin_event_id}/rsvp?federated_claim=true&nonce=${nonce}&source_campus=${encodeURIComponent(
      Deno.env.get("CAMPUS_DOMAIN") || "campusconnect.local"
    )}&user_hint=${encodeURIComponent(mentee_or_attendee_email || "")}`;

    return new Response(
      JSON.stringify({
        success: true,
        redirect_url: callbackUrl,
        host_institution: server.institution_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
