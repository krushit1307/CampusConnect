import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Signs a short-lived JWT for a confirmed RSVP and returns it.
 * The QR code on the PDF ticket encodes this JWT so event staff can
 * cryptographically verify attendees at the door.
 *
 * Accepts: { eventId: string }
 * Returns: { token: string }   — a signed JWT valid for 30 days
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Authenticate the caller
    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse and validate the request body
    let body: { eventId?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { eventId } = body;
    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Confirm the user has an active RSVP for this event
    const { data: rsvp, error: rsvpError } = await supabase
      .from("event_rsvps")
      .select("id, event_id, user_id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single();

    if (rsvpError || !rsvp) {
      return new Response(JSON.stringify({ error: "No RSVP found for this event" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Build and sign the JWT using the TICKET_JWT_SECRET
    const secret = Deno.env.get("TICKET_JWT_SECRET");
    if (!secret) {
      console.error("TICKET_JWT_SECRET is not set");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * 30; // 30 days

    const payload = {
      ticket_id: rsvp.id,
      event_id: rsvp.event_id,
      user_id: rsvp.user_id,
      iat: now,
      exp,
    };

    // Encode header and payload
    const encode = (obj: Record<string, unknown>) =>
      btoa(JSON.stringify(obj))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const header = encode({ alg: "HS256", typ: "JWT" });
    const payloadB64 = encode(payload);
    const signingInput = `${header}.${payloadB64}`;

    // HMAC-SHA256 signature
    const keyData = new TextEncoder().encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      new TextEncoder().encode(signingInput),
    );

    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const token = `${signingInput}.${sigB64}`;

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Ticket JWT Generation Error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred generating the ticket token." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
