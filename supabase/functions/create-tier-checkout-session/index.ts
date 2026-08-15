// =============================================================================
// Edge Function: Create Sponsorship Tier Checkout Session
// Issue: #3170 - Build a 'Club Sponsorship Tier Management' UI
// Description: Reserves a unit of inventory on a sponsorship tier using the
// concurrency-safe reserve_sponsorship_tier RPC (Postgres row lock), then
// creates a Stripe Checkout session for the B2B sponsor purchase. Rolls back
// the reservation if Stripe session creation fails.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2023-10-16",
});

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Authenticate the sponsor
        const authHeader = req.headers.get("Authorization")!;
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        // 2. Parse request
        const { tierId } = await req.json();
        if (!tierId) throw new Error("tierId is required");

        // 3. Fetch the tier for display purposes
        const { data: tier, error: tierError } = await supabase
            .from("sponsorship_tiers")
            .select("*, clubs(name)")
            .eq("id", tierId)
            .single();

        if (tierError || !tier) throw new Error("Sponsorship tier not found");

        // 4. Atomically reserve a unit of inventory (row-locked transaction)
        const { data: reservation, error: reserveError } = await supabase.rpc(
            "reserve_sponsorship_tier",
            { p_tier_id: tierId, p_sponsor_id: user.id }
        );

        if (reserveError) throw new Error(reserveError.message || "This tier is sold out.");

        const purchase = Array.isArray(reservation) ? reservation[0] : reservation;

        // 5. Create the Stripe Checkout session
        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: `${tier.clubs?.name || "Club"} - ${tier.name} Sponsorship`,
                                description: (tier.perks_json || []).join(", "),
                            },
                            unit_amount: tier.price,
                        },
                        quantity: 1,
                    },
                ],
                mode: "payment",
                success_url: `${req.headers.get("origin")}/clubs/${tier.club_id}/sponsorship/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${req.headers.get("origin")}/clubs/${tier.club_id}/sponsorship`,
                metadata: {
                    tier_id: tierId,
                    purchase_id: purchase.purchase_id,
                    sponsor_id: user.id,
                },
            });

            // Attach the Stripe session id to the pending purchase row
            await supabase
                .from("sponsorship_tier_purchases")
                .update({ stripe_checkout_session_id: session.id })
                .eq("id", purchase.purchase_id);

            return new Response(
                JSON.stringify({ sessionId: session.id, url: session.url }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        } catch (stripeErr) {
            // Roll back the reservation if Stripe session creation fails
            await supabase.rpc("release_sponsorship_tier", { p_purchase_id: purchase.purchase_id });
            throw stripeErr;
        }
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});