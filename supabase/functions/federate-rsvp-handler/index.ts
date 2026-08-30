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

    const { origin_event_id, user_email, user_name, user_role, action, hasRsvpd } = await req.json();

    if (!origin_event_id || !user_email || !action) {
      return new Response(
        JSON.stringify({ error: "Invalid payload format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve or create shadow profile for the federated user
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", user_email)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: crypto.randomUUID(),
          email: user_email,
          full_name: user_name || user_email.split("@")[0],
          role: user_role || "student",
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }
      profile = newProfile;
    }

    if (action === "check") {
      const { data: rsvp, error: rsvpError } = await supabase
        .from("event_rsvps")
        .select("id")
        .eq("event_id", origin_event_id)
        .eq("user_id", profile.id)
        .maybeSingle();

      if (rsvpError) throw rsvpError;

      return new Response(
        JSON.stringify({ attending: !!rsvp }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "toggle") {
      if (hasRsvpd) {
        // Cancel RSVP
        const { error: rsvpErr } = await supabase
          .from("event_rsvps")
          .delete()
          .match({ event_id: origin_event_id, user_id: profile.id });

        if (rsvpErr) throw rsvpErr;

        const { error: waitlistErr } = await supabase
          .from("event_waitlist")
          .delete()
          .match({ event_id: origin_event_id, user_id: profile.id });

        if (waitlistErr) throw waitlistErr;

        return new Response(
          JSON.stringify({ success: true, status: "cancelled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Join Event/Waitlist using the standard atomic RPC
        const { data, error: joinError } = await supabase.rpc("join_event_or_waitlist", {
          p_event_id: origin_event_id,
          p_user_id: profile.id,
          p_is_anonymous: false,
          p_resume_path: null,
          p_referred_by: null,
        });

        if (joinError) throw joinError;

        if (data && data.success) {
          return new Response(
            JSON.stringify({ success: true, status: data.status, position: data.position }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({ error: data?.error || "Failed to register RSVP" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ error: "Unsupported action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
