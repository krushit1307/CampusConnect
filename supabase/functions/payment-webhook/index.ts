import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";

const stripeSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || Deno.env.get("WEBHOOK_SECRET") || "";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, stripe-signature",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signatureHeader = req.headers.get("stripe-signature");
  if (!signatureHeader) {
    return new Response("Missing signature header", { status: 400 });
  }

  try {
    const rawBody = await req.text();

    if (!stripeSecret) {
      console.error("[Config Error] STRIPE_WEBHOOK_SECRET is missing.");
      return new Response("Server configuration error", { status: 500 });
    }

    // 1. Cryptographically verify webhook signature using Stripe SDK
    let stripeEvent;
    try {
      stripeEvent = await stripe.webhooks.constructEventAsync(
        rawBody,
        signatureHeader,
        stripeSecret
      );
    } catch (err: any) {
      console.warn("[Security Alert] Cryptographic signature mismatch:", err.message);
      return new Response("Invalid signature payload", { status: 400 });
    }

    const eventId = stripeEvent.id;

    if (!eventId) {
      return new Response("Missing event ID in body", { status: 400 });
    }

    // 2. Initialize Supabase client with admin service role key to bypass RLS limits
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Enforce Idempotency: check if webhook has already been processed
    const { data: existingWebhook, error: checkError } = await supabase
      .from("processed_webhooks")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (checkError) {
      console.error("[DB Error] Failed to lookup processed webhooks:", checkError);
      return new Response("Database lookup error", { status: 500 });
    }

    if (existingWebhook) {
      console.log(`[Webhook Ingestion] Event ${eventId} has already been processed. Skipping.`);
      return new Response(
        JSON.stringify({ status: "skipped", message: "Duplicate webhook event." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 4. Insert idempotency lock record to prevent duplicate race conditions
    const { error: insertLockError } = await supabase
      .from("processed_webhooks")
      .insert({ event_id: eventId, provider: "stripe" });

    if (insertLockError) {
      console.error("[DB Error] Failed to write idempotency lock:", insertLockError);
      return new Response("Idempotency insert lock failed", { status: 500 });
    }

    // 5. Check completed status and update event_rsvps table status to 'PAID'
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      const rsvpId = session.metadata?.rsvp_id;

      if (!rsvpId) {
        console.warn("[Webhook Ingestion] Missing metadata rsvp_id parameter.");
        return new Response("Missing rsvp_id metadata parameter", { status: 400 });
      }

      const { error: updateRsvpError } = await supabase
        .from("event_rsvps")
        .update({ status: "PAID" })
        .eq("id", rsvpId);

      if (updateRsvpError) {
        console.error(`[DB Error] Failed to update RSVP ${rsvpId} to PAID:`, updateRsvpError);
        return new Response("Failed to update RSVP status", { status: 500 });
      }

      console.log(`[Webhook Ingestion] Successfully set RSVP ${rsvpId} status to PAID.`);
    }

    return new Response(JSON.stringify({ status: "success", eventId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Webhook Ingestion Exception]:", errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
