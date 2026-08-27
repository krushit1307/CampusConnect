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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Authenticate user
    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse request body
    const body = await req.json().catch(() => ({}));
    const { rsvpId } = body;

    if (!rsvpId) {
      return new Response(JSON.stringify({ error: "Missing required parameter: rsvpId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch RSVP details
    const { data: rsvp, error: rsvpError } = await supabase
      .from("event_rsvps")
      .select("id, event_id, user_id, status, payment_intent_id, paid_amount_cents")
      .eq("id", rsvpId)
      .single();

    if (rsvpError || !rsvp) {
      return new Response(JSON.stringify({ error: "RSVP record not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    if (rsvp.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "You do not own this ticket reservation." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rsvp.status === "cancelled") {
      return new Response(JSON.stringify({ error: "This ticket has already been cancelled." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch Event details for timeline check
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("title, event_date, refund_policy_hours")
      .eq("id", rsvp.event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Associated event not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Evaluate refund rules based on event date and policy hours
    const now = Date.now();
    const eventTime = new Date(event.event_date).getTime();
    const timeDiffMs = eventTime - now;
    const policyHours = typeof event.refund_policy_hours === "number" ? event.refund_policy_hours : 48;

    let refundPercentage = 0;
    if (timeDiffMs >= policyHours * 60 * 60 * 1000) {
      // Within refund policy timeline -> 100% refund
      refundPercentage = 100;
    } else if (timeDiffMs > 0) {
      // Past timeline but event hasn't started yet -> 0% refund (Warning block / no refund)
      refundPercentage = 0;
    } else {
      // Event has already started or ended
      return new Response(JSON.stringify({ error: "Cannot cancel ticket after the event has started." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if it's a paid ticket or free
    const isPaid = !!rsvp.payment_intent_id && rsvp.paid_amount_cents > 0;
    const paidAmount = rsvp.paid_amount_cents || 0;
    const refundAmountCents = Math.round((paidAmount * refundPercentage) / 100);

    let stripeRefundId = "free_rsvp_cancel";

    // 6. Handle Stripe Refund if paid
    if (isPaid && refundAmountCents > 0) {
      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

      if (!stripeSecretKey || stripeSecretKey.startsWith("mock-")) {
        // Mock Refund for testing/development
        console.log(`[Stripe Mock] Refunding ${refundAmountCents} cents for intent ${rsvp.payment_intent_id}`);
        stripeRefundId = `re_mock_${crypto.randomUUID().replace(/-/g, "").substring(0, 24)}`;
      } else {
        try {
          const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
          const refund = await stripe.refunds.create({
            payment_intent: rsvp.payment_intent_id,
            amount: refundAmountCents,
          });
          stripeRefundId = refund.id;
        } catch (stripeErr: any) {
          console.error("Stripe refund call failed:", stripeErr);
          // Return user friendly message for negative balances/Connect issues
          return new Response(
            JSON.stringify({
              error: "Refund failed due to insufficient club funds. Please contact the event organizer directly to arrange your refund.",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 7. Execute database transaction updating RSVP, inserting logs, and restoring capacity
    const { data: txSuccess, error: txError } = await supabase.rpc("process_ticket_refund", {
      p_rsvp_id: rsvpId,
      p_payment_intent_id: rsvp.payment_intent_id || "FREE_TICKET",
      p_refund_amount_cents: refundAmountCents,
      p_stripe_refund_id: stripeRefundId,
    });

    if (txError || !txSuccess) {
      throw new Error(txError?.message || "Failed to commit refund transaction in database.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        refundAmountCents,
        refundPercentage,
        stripeRefundId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("refund-ticket error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
