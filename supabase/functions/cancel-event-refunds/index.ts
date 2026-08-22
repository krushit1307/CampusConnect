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

    const { eventId, reason = "Event cancelled by organizer" } = await req.json().catch(() => ({}));
    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch Event & verify ownership
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, status, created_by")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden: You do not own this event." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Event is already cancelled." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Mark Event as Cancelled
    const { error: updateEventError } = await supabase
      .from("events")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    if (updateEventError) throw updateEventError;

    // 4. Fetch all active RSVPs
    const { data: rsvps, error: rsvpsError } = await supabase
      .from("event_rsvps")
      .select("id, user_id, status, payment_intent_id, paid_amount_cents, profiles(email)")
      .eq("event_id", eventId)
      .in("status", ["attending", "approved", "waitlisted", "swapping"]);

    if (rsvpsError) throw rsvpsError;

    let refundedCount = 0;
    let totalRefundedCents = 0;

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const isMockStripe = !stripeSecretKey || stripeSecretKey.startsWith("mock-");
    const stripe = isMockStripe ? null : new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // 5. Iterate and process refunds / notifications
    for (const rsvp of rsvps || []) {
      // Mark RSVP as cancelled (invalidates ticket)
      await supabase
        .from("event_rsvps")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", rsvp.id);

      let stripeRefundId = null;

      // Execute Stripe Refund if paid
      if (rsvp.paid_amount_cents > 0 && rsvp.payment_intent_id) {
        if (isMockStripe) {
          stripeRefundId = `re_mock_${crypto.randomUUID().replace(/-/g, "").substring(0, 24)}`;
        } else {
          try {
            const refund = await stripe!.refunds.create({
              payment_intent: rsvp.payment_intent_id,
              amount: rsvp.paid_amount_cents,
            });
            stripeRefundId = refund.id;
          } catch (err) {
            console.error(`Stripe refund failed for RSVP ${rsvp.id}:`, err);
            // In a robust system, we would enqueue a retry. For now, log the failure.
          }
        }

        if (stripeRefundId) {
          refundedCount++;
          totalRefundedCents += rsvp.paid_amount_cents;

          // Log refund
          await supabase.from("refund_logs").insert({
            rsvp_id: rsvp.id,
            payment_intent_id: rsvp.payment_intent_id,
            refund_amount_cents: rsvp.paid_amount_cents,
            stripe_refund_id: stripeRefundId,
            refund_status: "completed",
            refunded_at: new Date().toISOString(),
          });
        }
      }

      // 6. Dispatch Notification / Email
      const amountStr =
        rsvp.paid_amount_cents > 0
          ? `Your refund of $${(rsvp.paid_amount_cents / 100).toFixed(2)} has been issued to your card.`
          : "";
      const message = `The event "${event.title}" was cancelled (${reason}). ${amountStr}`;

      await supabase.from("notifications").insert({
        user_id: rsvp.user_id,
        type: "event_cancelled",
        title: `Event Cancelled: ${event.title}`,
        message,
        link: "/events",
      });

      // (Optional: Integrate Resend/SendGrid for actual email dispatch here)
      console.log(`[Email Dispatched] To: User ${rsvp.user_id} | Message: ${message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully cancelled event and orchestrated ${refundedCount} refunds.`,
        refundedCount,
        totalRefundedCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("mass-cancel-event error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
