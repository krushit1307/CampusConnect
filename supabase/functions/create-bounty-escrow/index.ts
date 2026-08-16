// =============================================================================
// Edge Function: Create Bounty Escrow
// Issue: #3318 - Implement 'Interactive Lost Item Bounty' System
// Description: Initiates a Stripe Checkout session to capture the bounty funds.
// The funds are held in the platform's connected account (escrow) until the 
// item is successfully returned or a dispute is resolved.
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
        const authHeader = req.headers.get("Authorization")!;
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { lost_item_id, amount_cents } = await req.json();
        if (!lost_item_id || !amount_cents || amount_cents < 100) {
            throw new Error("Invalid item ID or amount (minimum $1.00)");
        }

        // Verify the user owns this lost item
        const { data: item, error: itemError } = await supabase
            .from("lost_items")
            .select("id, user_id, title, bounty_status")
            .eq("id", lost_item_id)
            .single();

        if (itemError || !item) throw new Error("Lost item not found");
        if (item.user_id !== user.id) throw new Error("Unauthorized to add bounty to this item");
        if (item.bounty_status !== 'none') throw new Error("Bounty already active or in dispute");

        // Create a Stripe Checkout Session
        // We use payment_intent_data.capture_method = 'manual' to hold funds in escrow
        // Alternatively, we capture immediately and hold in our platform account balance
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: `Bounty Reward: ${item.title}`,
                            description: "Funds held in escrow until item is returned.",
                        },
                        unit_amount: amount_cents,
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            success_url: `${req.headers.get("origin")}/lost-found/${item.id}?bounty=success`,
            cancel_url: `${req.headers.get("origin")}/lost-found/${item.id}?bounty=cancelled`,
            metadata: {
                user_id: user.id,
                lost_item_id: item.id,
                type: "bounty_escrow"
            },
            // Capture immediately but hold in platform account (requires Stripe Connect setup)
            // For simplicity, we assume the platform account holds the balance.
        });

        // Update the lost item with the pending session ID
        await supabase
            .from("lost_items")
            .update({
                bounty_amount_cents: amount_cents,
                stripe_payment_intent_id: session.payment_intent,
                bounty_status: 'escrow'
            })
            .eq("id", lost_item_id);

        return new Response(
            JSON.stringify({ sessionId: session.id, url: session.url }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[CreateBountyEscrow] Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
});
