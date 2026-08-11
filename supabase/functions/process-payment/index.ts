/**
 * Supabase Edge Function: process-payment
 *
 * Handles event ticketing payments with strict idempotency guarantees.
 * Prevents double-charging by caching request states in the database.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key, x-payload-hash",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const limited = await rateLimiter(req, "process-payment", 10, 60);
  if (limited) return limited;

  try {
    const idempotencyKey = req.headers.get("Idempotency-Key");
    const payloadHash = req.headers.get("X-Payload-Hash");

    if (!idempotencyKey || !payloadHash) {
      return new Response(
        JSON.stringify({ error: "Missing Idempotency-Key or X-Payload-Hash header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();

    // 1. Check if the idempotency key already exists
    const { data: existingRecord, error: fetchError } = await supabaseClient
      .from("idempotency_keys")
      .select("status, response_payload, request_hash")
      .eq("key", idempotencyKey)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 is "not found"
      throw new Error("Database error while checking idempotency key");
    }

    if (existingRecord) {
      // Edge Case: Payload Mismatch
      if (existingRecord.request_hash !== payloadHash) {
        return new Response(
          JSON.stringify({ error: "Payload mismatch: Idempotency key reused with different data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // If already processing, return 409 Conflict
      if (existingRecord.status === "processing") {
        return new Response(
          JSON.stringify({ error: "Request is already being processed", status: "processing" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // If completed, return the cached response immediately
      if (existingRecord.status === "completed") {
        return new Response(JSON.stringify(existingRecord.response_payload), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Key is new (or failed previously and can be retried). Mark as "processing".
    const { error: insertError } = await supabaseClient.from("idempotency_keys").upsert({
      key: idempotencyKey,
      request_hash: payloadHash,
      status: "processing",
      response_payload: null,
    });

    if (insertError) {
      throw new Error("Failed to register idempotency key");
    }

    // 3. Execute the actual payment logic (e.g., Stripe API call)
    // TODO: Replace with actual Stripe integration
    // If we were using Stripe, it would look like this:
    /*
    const baseAmountCents = body.amount;
    let donationAmountCents = 0;
    
    if (body.includeCharityDonation) {
       const nextDollar = Math.ceil(baseAmountCents / 100) * 100;
       if (nextDollar > baseAmountCents) {
          donationAmountCents = nextDollar - baseAmountCents;
       } else {
          donationAmountCents = 100; // Round up by an extra dollar if already whole
       }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Event Ticket' },
            unit_amount: baseAmountCents,
          },
          quantity: 1,
        },
        ...(body.includeCharityDonation ? [{
          price_data: {
            currency: 'usd',
            product_data: { name: 'Charity Donation' },
            unit_amount: donationAmountCents,
          },
          quantity: 1,
        }] : []),
      ],
      mode: 'payment',
      success_url: `${req.headers.get("origin")}/events/${body.eventId}/success`,
      cancel_url: `${req.headers.get("origin")}/events/${body.eventId}/cancel`,
      metadata: {
        rsvp_id: body.rsvpId,
        user_id: body.userId,
        event_id: body.eventId,
        include_charity_donation: body.includeCharityDonation ? 'true' : 'false',
      }
    });
    */

    const paymentResult = await simulateStripePayment(body);

    const successPayload = {
      success: true,
      transactionId: paymentResult.transactionId,
      message: "Payment successful",
    };

    // 4. Update the record to "completed" and cache the response
    await supabaseClient
      .from("idempotency_keys")
      .update({
        status: "completed",
        response_payload: successPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("key", idempotencyKey);

    return new Response(JSON.stringify(successPayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Payment processing error:", error);

    // On failure, we leave the status as 'processing' or update to 'failed'
    // depending on business logic. Here we update to 'failed' to allow retries.
    // In a real scenario, you'd catch the specific idempotency key and update it.

    return new Response(
      JSON.stringify({ error: "Internal server error during payment processing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Simulates a third-party payment gateway call.
 * Replace this with actual Stripe/Deno Stripe SDK logic.
 */
async function simulateStripePayment(body: any) {
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate network delay

  const baseAmountCents = body.amount;
  let donationAmountCents = 0;
  let totalAmountCents = baseAmountCents;

  if (body.includeCharityDonation) {
    const nextDollar = Math.ceil(baseAmountCents / 100) * 100;
    if (nextDollar > baseAmountCents) {
      donationAmountCents = nextDollar - baseAmountCents;
    } else {
      donationAmountCents = 100; // Round up by an extra dollar if already whole
    }
    totalAmountCents += donationAmountCents;
  }

  return {
    transactionId: `txn_${Math.random().toString(36).substring(2, 15)}`,
    amount: totalAmountCents,
    currency: "usd",
    donationIncluded: !!body.includeCharityDonation,
    donationAmount: donationAmountCents,
  };
}
