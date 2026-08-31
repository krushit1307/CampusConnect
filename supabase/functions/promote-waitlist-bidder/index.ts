// =============================================================================
// Edge Function: Promote Waitlist Bidder
// Issue: #3544 - Build an 'Interactive Event Waitlist Bidding' System
// Description: Triggered via Database Webhook when a registered user cancels.
// Queries the highest bidder on the waitlist, captures their authorized Stripe
// payment, and promotes them to 'registered' status.
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

  // Verify Webhook secret
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_WEBHOOK_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { record } = await req.json(); // The cancelled RSVP
  if (!record || record.status !== "cancelled") {
    return new Response("Invalid payload", { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const eventId = record.event_id;

    let topBidder = null;
    let isNewBidTable = false;

    // 1. Find the highest bidder from waitlist_bids table
    const { data: topBid, error: bidError } = await supabaseAdmin
      .from("waitlist_bids")
      .select("id, user_id, bid_amount, stripe_setup_intent_id, profiles(stripe_customer_id)")
      .eq("event_id", eventId)
      .eq("bid_status", "authorized")
      .order("bid_amount", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bidError) {
      console.error("Error querying waitlist_bids:", bidError);
    }

    if (topBid) {
      topBidder = {
        id: topBid.id,
        user_id: topBid.user_id,
        bid_amount_cents: Math.round(Number(topBid.bid_amount) * 100),
        stripe_setup_intent_id: topBid.stripe_setup_intent_id,
        profiles: topBid.profiles,
      };
      isNewBidTable = true;
    } else {
      // Fallback to legacy event_rsvps bidding columns
      const { data: legacyBidder, error: legacyError } = await supabaseAdmin
        .from("event_rsvps")
        .select(
          "id, user_id, bid_amount_cents, stripe_setup_intent_id, profiles(stripe_customer_id)",
        )
        .eq("event_id", eventId)
        .eq("status", "waitlisted")
        .eq("bid_status", "authorized")
        .gt("bid_amount_cents", 0)
        .order("bid_amount_cents", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (legacyError) throw legacyError;
      if (legacyBidder) {
        topBidder = legacyBidder;
      }
    }

    if (!topBidder) {
      return new Response(JSON.stringify({ message: "No authorized bidders on waitlist." }), {
        headers: corsHeaders,
      });
    }

    // 2. Retrieve the SetupIntent to get the PaymentMethod
    const setupIntent = await stripe.setupIntents.retrieve(topBidder.stripe_setup_intent_id!);
    if (!setupIntent.payment_method) throw new Error("No payment method attached to SetupIntent");

    // 3. Create and Capture a PaymentIntent for the bid amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: topBidder.bid_amount_cents,
      currency: "usd",
      customer: (topBidder.profiles as any)?.stripe_customer_id || undefined,
      payment_method: setupIntent.payment_method as string,
      off_session: true,
      confirm: true,
      description: `Charity Waitlist Bid for Event ${eventId}`,
      metadata: {
        rsvp_id: topBidder.id,
        event_id: eventId,
        type: "waitlist_bid_capture",
      },
    });

    if (paymentIntent.status !== "succeeded") {
      // Mark bid as failed and try next bidder
      if (isNewBidTable) {
        await supabaseAdmin
          .from("waitlist_bids")
          .update({ bid_status: "failed" })
          .eq("id", topBidder.id);
      }
      await supabaseAdmin
        .from("event_rsvps")
        .update({ bid_status: "failed" })
        .eq("user_id", topBidder.user_id)
        .eq("event_id", eventId);
      throw new Error("Payment capture failed.");
    }

    // 4. Promote the user: remove from waitlist and register
    await supabaseAdmin
      .from("event_waitlist")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", topBidder.user_id);

    if (isNewBidTable) {
      await supabaseAdmin
        .from("waitlist_bids")
        .update({ bid_status: "captured", updated_at: new Date().toISOString() })
        .eq("id", topBidder.id);
    }

    // Upsert into event_rsvps to mark as registered
    const { data: existingRsvp } = await supabaseAdmin
      .from("event_rsvps")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", topBidder.user_id)
      .maybeSingle();

    if (existingRsvp) {
      await supabaseAdmin
        .from("event_rsvps")
        .update({
          status: "registered",
          bid_status: "captured",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRsvp.id);
    } else {
      await supabaseAdmin.from("event_rsvps").insert({
        event_id: eventId,
        user_id: topBidder.user_id,
        status: "registered",
        bid_status: "captured",
        rsvp_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // 5. Send Push Notification / Email to the winner
    await supabaseAdmin.from("notifications").insert({
      user_id: topBidder.user_id,
      title: "🎉 You won the waitlist bid!",
      body: `Your bid of $${(topBidder.bid_amount_cents / 100).toFixed(2)} was accepted. You are now registered for the event!`,
      link: `/events/${eventId}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        promoted_user: topBidder.user_id,
        amount_captured: paymentIntent.amount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[PromoteWaitlistBidder] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
