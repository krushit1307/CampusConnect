/**
 * Supabase Edge Function: process-vendor-payment
 *
 * Atomically transfers food tickets / digital balance credits to vendors
 * and triggers a Stripe Connected Account Transfer.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key, x-payload-hash",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get authenticating user
    const clientSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await clientSupabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { vendorId, amountCents, description } = body;

    if (!vendorId || !amountCents || amountCents <= 0) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid vendorId or amountCents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call public.process_vendor_wallet_payment database function
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc(
      "process_vendor_wallet_payment",
      {
        p_user_id: user.id,
        p_vendor_id: vendorId,
        p_amount_cents: amountCents,
        p_description: description || `Scan at Vendor Booth`,
      }
    );

    if (rpcError || !rpcResult?.success) {
      return new Response(
        JSON.stringify({ error: rpcError?.message || "Wallet transaction failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute Stripe Connect transfer to route funds directly to the vendor's linked connected account
    let stripeTransfer;
    try {
      stripeTransfer = await stripe.transfers.create({
        amount: rpcResult.vendor_payout_cents,
        currency: "usd",
        destination: rpcResult.stripe_account_id,
        description: `Festival payout: ${description || "booth purchase"}`,
        metadata: {
          vendor_id: vendorId,
          user_id: user.id,
          transaction_id: rpcResult.transaction_id,
          fee_cents: rpcResult.fee_cents,
        },
      });
    } catch (stripeErr: any) {
      console.error("Stripe Connect payout routing failed:", stripeErr);
      // In a production environment, you might log to a dead letter queue or a payout reconciliation table.
      // We return the local wallet deduction confirmation but warn about Stripe Connect transfer delay.
      return new Response(
        JSON.stringify({
          success: true,
          walletTransactionId: rpcResult.transaction_id,
          payoutStatus: "failed_stripe",
          error: stripeErr.message || "Failed to trigger Stripe transfer",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        walletTransactionId: rpcResult.transaction_id,
        stripeTransferId: stripeTransfer.id,
        payoutStatus: "completed",
        payoutAmountCents: rpcResult.vendor_payout_cents,
        feeCents: rpcResult.fee_cents,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Vendor payment splitting edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
