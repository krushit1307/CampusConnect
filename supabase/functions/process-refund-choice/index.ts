// =============================================================================
// Edge Function: Process Event Cancellation Refund Choice
// Issue: #4522 - Automated "Event Cancellation" Credit Issuance
// Description: Allows attendees of cancelled events to choose between:
// 1) Full Refund to Card (calls Stripe Refund API)
// 2) Platform Credit with 10% Bonus (skips Stripe, credits user_platform_balance & ledger)
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { verifyAuth } from "../shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Authenticate User
    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch (_err) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse Request
    const { claimId, choice } = await req.json().catch(() => ({}));

    if (!claimId || !choice || !["card", "credit"].includes(choice)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid claimId or choice (must be 'card' or 'credit')" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Fetch Claim
    const { data: claim, error: claimError } = await supabase
      .from("cancellation_refund_claims")
      .select("*, event_rsvps(id, payment_intent_id, paid_amount_cents), events(title)")
      .eq("id", claimId)
      .eq("user_id", user.id)
      .single();

    if (claimError || !claim) {
      return new Response(JSON.stringify({ error: "Refund claim not found or unauthorized" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (claim.status !== "pending_choice") {
      return new Response(
        JSON.stringify({
          error: `This refund claim has already been resolved (${claim.status}).`,
          status: claim.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const eventTitle = claim.events?.title || "Campus Event";

    // 4. Handle Choice
    if (choice === "credit") {
      // Option 2: 10% Bonus Platform Credit - DO NOT execute Stripe Refund!
      const bonusAmountCents = claim.credit_amount_cents - claim.original_amount_cents;

      // Ensure user platform balance exists
      const { data: existingBal } = await supabase
        .from("user_platform_balances")
        .select("balance_cents, lifetime_credited_cents, bonus_earned_cents")
        .eq("user_id", user.id)
        .maybeSingle();

      const currentBalance = existingBal?.balance_cents || 0;
      const currentCredited = existingBal?.lifetime_credited_cents || 0;
      const currentBonus = existingBal?.bonus_earned_cents || 0;

      const newBalance = currentBalance + claim.credit_amount_cents;

      // Upsert balance
      await supabase.from("user_platform_balances").upsert({
        user_id: user.id,
        balance_cents: newBalance,
        lifetime_credited_cents: currentCredited + claim.credit_amount_cents,
        lifetime_spent_cents: existingBal?.lifetime_spent_cents || 0,
        bonus_earned_cents: currentBonus + bonusAmountCents,
        updated_at: new Date().toISOString(),
      });

      // Insert into internal User Platform Credit Ledger
      await supabase.from("user_platform_credit_ledger").insert({
        user_id: user.id,
        amount_cents: claim.credit_amount_cents,
        balance_after_cents: newBalance,
        transaction_type: "cancellation_credit",
        description: `10% bonus credit for cancelled event "${eventTitle}"`,
        reference_id: claim.event_id,
        bonus_amount_cents: bonusAmountCents,
        metadata: {
          claim_id: claim.id,
          rsvp_id: claim.rsvp_id,
          original_amount_cents: claim.original_amount_cents,
          bonus_percentage: claim.bonus_percentage,
        },
      });

      // Update claim status
      await supabase
        .from("cancellation_refund_claims")
        .update({
          status: "credit_issued",
          selected_option: "credit",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", claim.id);

      // Notify User
      const creditDollars = (claim.credit_amount_cents / 100).toFixed(2);
      const bonusDollars = (bonusAmountCents / 100).toFixed(2);
      const message = `+$${creditDollars} in CampusConnect Credit (including $${bonusDollars} bonus) has been added to your balance for "${eventTitle}". It will automatically apply to your next checkout!`;

      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "cancellation_credit_issued",
        title: `Platform Credit Issued ($${creditDollars})`,
        message,
        link: "/wallet",
      });

      return new Response(
        JSON.stringify({
          success: true,
          choice: "credit",
          credit_amount_cents: claim.credit_amount_cents,
          bonus_amount_cents: bonusAmountCents,
          new_balance_cents: newBalance,
          message,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else {
      // Option 1: Card Refund - Execute Stripe Refund
      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
      const isMockStripe = !stripeSecretKey || stripeSecretKey.startsWith("mock-");
      const stripe = isMockStripe
        ? null
        : new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

      let stripeRefundId: string | null = null;
      const paymentIntentId = claim.event_rsvps?.payment_intent_id;
      const refundAmountCents = claim.original_amount_cents;

      if (paymentIntentId) {
        if (isMockStripe) {
          stripeRefundId = `re_mock_${crypto.randomUUID().replace(/-/g, "").substring(0, 24)}`;
        } else {
          try {
            const refund = await stripe!.refunds.create({
              payment_intent: paymentIntentId,
              amount: refundAmountCents,
            });
            stripeRefundId = refund.id;
          } catch (err: any) {
            console.error(`Stripe refund failed for claim ${claim.id}:`, err);
            return new Response(
              JSON.stringify({ error: `Stripe refund failed: ${err.message}` }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }

        // Log refund in refund_logs
        await supabase.from("refund_logs").insert({
          rsvp_id: claim.rsvp_id,
          payment_intent_id: paymentIntentId,
          refund_amount_cents: refundAmountCents,
          stripe_refund_id: stripeRefundId,
          refund_status: "completed",
          refunded_at: new Date().toISOString(),
        });
      }

      // Update claim status
      await supabase
        .from("cancellation_refund_claims")
        .update({
          status: "card_refunded",
          selected_option: "card",
          stripe_refund_id: stripeRefundId,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", claim.id);

      const refundDollars = (refundAmountCents / 100).toFixed(2);
      const message = `Your card refund of $${refundDollars} for "${eventTitle}" has been initiated and should appear in 3-5 business days.`;

      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "card_refund_processed",
        title: `Card Refund Initiated ($${refundDollars})`,
        message,
        link: "/events",
      });

      return new Response(
        JSON.stringify({
          success: true,
          choice: "card",
          original_amount_cents: refundAmountCents,
          stripe_refund_id: stripeRefundId,
          message,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error: any) {
    console.error("[process-refund-choice] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
