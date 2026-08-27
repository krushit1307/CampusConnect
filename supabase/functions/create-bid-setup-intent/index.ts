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
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { rsvp_id, bid_amount_cents } = await req.json();
        if (!rsvp_id || !bid_amount_cents || bid_amount_cents < 100) {
            throw new Error("Invalid RSVP or bid amount (minimum $1.00)");
        }

        // Verify the user owns this RSVP and it is waitlisted
        const { data: rsvp, error: rsvpError } = await supabase
            .from("event_rsvps")
            .select("id, user_id, status, events(is_bidding_enabled)")
            .eq("id", rsvp_id)
            .single();

        if (rsvpError || !rsvp) throw new Error("RSVP not found");
        if (rsvp.user_id !== user.id) throw new Error("Unauthorized to bid on this RSVP");
        if (rsvp.status !== "waitlisted") throw new Error("Can only bid while on the waitlist");
        if (!(rsvp.events as any)?.is_bidding_enabled) throw new Error("Bidding is disabled for this event");

        // Create Stripe SetupIntent
        const setupIntent = await stripe.setupIntents.create({
            payment_method_types: ["card"],
            metadata: {
                user_id: user.id,
                rsvp_id: rsvp.id,
                bid_amount_cents: bid_amount_cents.toString(),
                type: "waitlist_bid"
            },
            // We don't use capture_method here because SetupIntents only authorize/verify the card.
            // Actual capture will happen via PaymentIntent created from the SetupIntent's PaymentMethod later.
        });

        // Update the RSVP with the SetupIntent ID and pending bid
        await supabase
            .from("event_rsvps")
            .update({
                stripe_setup_intent_id: setupIntent.id,
                bid_amount_cents: bid_amount_cents,
                bid_status: 'authorized',
                bid_updated_at: new Date().toISOString()
            })
            .eq("id", rsvp_id);

        return new Response(
            JSON.stringify({ client_secret: setupIntent.client_secret, setup_intent_id: setupIntent.id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[CreateBidSetupIntent] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 });
    }
});
