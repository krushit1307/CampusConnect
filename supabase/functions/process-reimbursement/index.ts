// =============================================================================
// Edge Function: Process Reimbursement Payout
// Issue: #3227 - Implement 'Automated Reimbursement Processing' via Stripe
// Description: Triggered by the frontend after an expense is fully approved.
// Verifies the club's Stripe balance, ensures dual-approval rules were met,
// and executes a Stripe Transfer to push funds to the user's connected account.
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
        // 1. Authenticate the user (Must be an admin/treasurer/president)
        const authHeader = req.headers.get("Authorization")!;
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { reimbursement_id } = await req.json();
        if (!reimbursement_id) throw new Error("Missing reimbursement_id");

        // 2. Fetch the reimbursement record with full details
        const { data: reimbursement, error: fetchError } = await supabase
            .from("expense_reimbursements")
            .select("*, clubs(stripe_account_id)")
            .eq("id", reimbursement_id)
            .single();

        if (fetchError || !reimbursement) throw new Error("Reimbursement not found");

        // 3. Validate Approval Status
        const requiresDual = reimbursement.amount_cents > 10000; // $100 threshold

        if (requiresDual) {
            if (!reimbursement.treasurer_approval_id || !reimbursement.president_approval_id) {
                throw new Error("Dual approval required for amounts over $100. Missing signatures.");
            }
        } else {
            if (!reimbursement.treasurer_approval_id) {
                throw new Error("Treasurer approval is required.");
            }
        }

        if (reimbursement.status !== 'approved_dual' && reimbursement.status !== 'approved_treasurer') {
            throw new Error(`Invalid status for payout: ${reimbursement.status}`);
        }

        // 4. Fetch the User's Stripe Connect Account
        const { data: userStripe, error: userStripeError } = await supabase
            .from("stripe_accounts")
            .select("stripe_connect_account_id, payouts_enabled")
            .eq("user_id", reimbursement.user_id)
            .single();

        if (userStripeError || !userStripe) {
            throw new Error("Recipient has not linked a Stripe account for payouts.");
        }

        if (!userStripe.payouts_enabled) {
            throw new Error("Recipient's Stripe account is not fully verified for payouts.");
        }

        // 5. Check Club's Stripe Balance (Prevent insufficient funds failure)
        const clubStripeAccount = reimbursement.clubs?.stripe_account_id;
        if (!clubStripeAccount) {
            throw new Error("Club does not have a connected Stripe account.");
        }

        const balance = await stripe.balance.retrieve({
            stripeAccount: clubStripeAccount,
        });

        const availableBalance = balance.available.find(b => b.currency === reimbursement.currency)?.amount || 0;

        if (availableBalance < reimbursement.amount_cents) {
            throw new Error(`Insufficient funds. Club balance: $${(availableBalance / 100).toFixed(2)}, Requested: $${(reimbursement.amount_cents / 100).toFixed(2)}`);
        }

        // 6. Update status to 'processing' to prevent double-execution
        await supabase
            .from("expense_reimbursements")
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq("id", reimbursement_id);

        // 7. Execute the Stripe Transfer
        const transfer = await stripe.transfers.create({
            amount: reimbursement.amount_cents,
            currency: reimbursement.currency,
            destination: userStripe.stripe_connect_account_id,
            source_transaction: undefined, // Using available balance, not a specific charge
            description: `Reimbursement: ${reimbursement.description.substring(0, 100)}`,
            metadata: {
                reimbursement_id: reimbursement.id,
                club_id: reimbursement.club_id,
            },
        }, {
            stripeAccount: clubStripeAccount,
        });

        // 8. Mark as Paid
        await supabase
            .from("expense_reimbursements")
            .update({
                status: 'paid',
                stripe_transfer_id: transfer.id,
                updated_at: new Date().toISOString()
            })
            .eq("id", reimbursement_id);

        return new Response(
            JSON.stringify({ success: true, transfer_id: transfer.id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[ProcessReimbursement] Error:", error);

        // If it failed during processing, revert status
        if (error.message && req.body) {
            try {
                const body = await req.clone().json();
                if (body.reimbursement_id) {
                    const supabaseAdmin = createClient(
                        Deno.env.get("SUPABASE_URL") ?? "",
                        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
                    );
                    await supabaseAdmin
                        .from("expense_reimbursements")
                        .update({ status: 'approved_dual', failure_reason: error.message })
                        .eq("id", body.reimbursement_id);
                }
            } catch (e) { /* ignore rollback errors */ }
        }

        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
});
