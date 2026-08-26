// =============================================================================
// Edge Function: Release Bounty
// Issue: #3318 - Implement 'Interactive Lost Item Bounty' System
// Description: Triggered when the loser confirms the item was returned.
// Executes a Stripe Transfer to move the escrowed funds (minus a platform fee)
// to the finder's connected Stripe account.
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

const PLATFORM_FEE_PERCENTAGE = 0.05; // 5% platform fee

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

        const { lost_item_id } = await req.json();
        if (!lost_item_id) throw new Error("Missing lost_item_id");

        // 1. Fetch the lost item and verify ownership
        const { data: item, error: itemError } = await supabase
            .from("lost_items")
            .select("*, profiles:finder_user_id (stripe_connect_account_id)")
            .eq("id", lost_item_id)
            .single();

        if (itemError || !item) throw new Error("Lost item not found");
        if (item.user_id !== user.id) throw new Error("Only the item owner can release funds");
        if (item.bounty_status !== 'escrow') throw new Error("Funds are not in escrow");
        if (!item.finder_user_id) throw new Error("No finder assigned to this item");

        // 2. Verify the finder has a connected Stripe account
        const finderStripeAccount = (item.profiles as any)?.stripe_connect_account_id;
        if (!finderStripeAccount) {
            throw new Error("The finder has not linked a Stripe account to receive the bounty.");
        }

        // 3. Calculate amounts
        const totalBounty = item.bounty_amount_cents;
        const platformFee = Math.round(totalBounty * PLATFORM_FEE_PERCENTAGE);
        const finderPayout = totalBounty - platformFee;

        // 4. Execute Stripe Transfer
        // Assuming the funds are already in the platform's balance from the Checkout session
        const transfer = await stripe.transfers.create({
            amount: finderPayout,
            currency: "usd",
            destination: finderStripeAccount,
            description: `Bounty payout for: ${item.title}`,
            metadata: {
                lost_item_id: item.id,
                finder_id: item.finder_user_id,
            },
        });

        // 5. Update database state
        await supabase
            .from("lost_items")
            .update({
                bounty_status: 'released',
                released_at: new Date().toISOString()
            })
            .eq("id", lost_item_id);

        return new Response(
            JSON.stringify({ success: true, transfer_id: transfer.id, payout_amount: finderPayout }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[ReleaseBounty] Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
});
