import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function generateSignature(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));

  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hashHex}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { event_type, target_url, secret_key, user_id, ticket_tier_id } = await req.json();

    if (!event_type || !target_url || !secret_key || !user_id) {
      return new Response("Missing required parameters", { status: 400 });
    }

    // 1. Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", user_id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
    }

    const firstName = profile?.first_name || "Unknown";

    // 2. Fetch ticket tier details
    let ticketType = "Standard";
    if (ticket_tier_id) {
      const { data: tier, error: tierError } = await supabase
        .from("ticket_tiers")
        .select("name")
        .eq("id", ticket_tier_id)
        .single();

      if (tierError) {
        console.error("Error fetching ticket tier:", tierError);
      } else if (tier?.name) {
        ticketType = tier.name;
      }
    }

    // 3. Construct JSON payload
    const payload = {
      event: event_type === "RSVP_CREATED" ? "RSVP" : "CHECK_IN",
      user: firstName,
      ticket_type: ticketType,
    };

    const payloadString = JSON.stringify(payload);

    // 4. Generate HMAC-SHA256 signature
    const signature = await generateSignature(secret_key, payloadString);

    // 5. Send secure POST request
    const response = await fetch(target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CampusConnect-Signature": signature,
      },
      body: payloadString,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Webhook delivery failed for target ${target_url}: ${response.status} ${errorText}`);
      return new Response(`Webhook delivery returned status ${response.status}`, { status: 502 });
    }

    return new Response("Webhook published successfully", { status: 200 });
  } catch (error) {
    console.error("Error in publish-club-webhooks function:", error);
    return new Response(error instanceof Error ? error.message : "Internal Server Error", { status: 500 });
  }
});
