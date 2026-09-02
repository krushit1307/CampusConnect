// =============================================================================
// Edge Function: Create Bid SetupIntent
// Issue: #3544 - Build an 'Interactive Event Waitlist Bidding' System
// Description: Creates a Stripe SetupIntent to authorize a user's credit card
//  for a specific bid amount without capturing funds immediately.Returns the
// client_secret to the frontend for Stripe Elements confirmation.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { rsvp_id, bid_amount_cents } = await req.json();
    if (!rsvp_id || !bid_amount_cents || bid_amount_cents < 100) {
      throw new Error("Invalid RSVP or bid amount (minimum $1.00)");
    }

    // Verify the user owns this RSVP and it is waitlisted
    const { data: rsvp, error: rsvpError } = await supabase
      .from("event_rsvps")
      .select(
        "id, user_id, status, event_id, events(is_bidding_enabled, waitlist_bidding, ticket_price)",
      )
      .eq("id", rsvp_id)
      .single();

    if (rsvpError || !rsvp) throw new Error("RSVP not found");
    if (rsvp.user_id !== user.id) throw new Error("Unauthorized to bid on this RSVP");
    if (rsvp.status !== "waitlisted") throw new Error("Can only bid while on the waitlist");

    const eventData = rsvp.events as any;
    const isBidding = eventData?.is_bidding_enabled || eventData?.waitlist_bidding;
    if (!isBidding) throw new Error("Bidding is disabled for this event");

    // Validate minimum bid amount (Ticket Price)
    const ticketPrice = eventData?.ticket_price || 0;
    const minBidCents = ticketPrice * 100;
    if (bid_amount_cents < minBidCents) {
      throw new Error(`Bid amount must be at least the ticket price of $${ticketPrice.toFixed(2)}`);
    }

    // Create Stripe SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
      metadata: {
        user_id: user.id,
        rsvp_id: rsvp.id,
        event_id: rsvp.event_id,
        bid_amount_cents: bid_amount_cents.toString(),
        type: "waitlist_bid",
      },
    });

    // Store/Upsert the bid in the waitlist_bids table
    const { error: bidDbError } = await supabase.from("waitlist_bids").upsert(
      {
        event_id: rsvp.event_id,
        user_id: user.id,
        bid_amount: bid_amount_cents / 100, // Store as numeric (dollars)
        stripe_setup_intent_id: setupIntent.id,
        bid_status: "authorized",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,user_id" },
    );

    if (bidDbError) throw bidDbError;

    // Also update the event_rsvps for backward compatibility
    await supabase
      .from("event_rsvps")
      .update({
        stripe_setup_intent_id: setupIntent.id,
        bid_amount_cents: bid_amount_cents,
        bid_status: "authorized",
        bid_updated_at: new Date().toISOString(),
      })
      .eq("id", rsvp_id);

    return new Response(
      JSON.stringify({ client_secret: setupIntent.client_secret, setup_intent_id: setupIntent.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[CreateBidSetupIntent] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: corsHeaders,
      status: 400,
    });
  }
});
