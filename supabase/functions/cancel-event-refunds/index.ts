import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { trace, SpanStatusCode } from "npm:@opentelemetry/api";

const tracer = trace.getTracer("cancel-event-refunds");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  return await tracer.startActiveSpan("POST /cancel-event-refunds", async (rootSpan) => {
    rootSpan.setAttribute("http.method", req.method);
    rootSpan.setAttribute("http.url", req.url);

    if (req.method === "OPTIONS") {
      rootSpan.setAttribute("http.status_code", 200);
      rootSpan.end();
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
        user = await tracer.startActiveSpan("verifyAuth", async (span) => {
          const res = await verifyAuth(req, supabase);
          span.setAttribute("user.id", res.id);
          span.end();
          return res;
        });
      } catch (err: any) {
        rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: "Unauthorized" });
        rootSpan.setAttribute("http.status_code", 401);
        rootSpan.end();
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { eventId, reason = "Event cancelled by organizer" } = await req
        .json()
        .catch(() => ({}));
      rootSpan.setAttribute("app.event_id", eventId || "missing");
      rootSpan.setAttribute("app.cancellation_reason", reason);

      if (!eventId) {
        rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: "Missing eventId" });
        rootSpan.setAttribute("http.status_code", 400);
        rootSpan.end();
        return new Response(JSON.stringify({ error: "Missing eventId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Fetch Event & verify ownership
      const { data: event, error: eventError } = await tracer.startActiveSpan(
        "supabase.fetch_event",
        async (span) => {
          span.setAttribute("db.system", "postgresql");
          span.setAttribute("db.operation", "SELECT");
          span.setAttribute("db.sql.table", "events");
          const res = await supabase
            .from("events")
            .select("id, title, status, created_by")
            .eq("id", eventId)
            .single();
          if (res.error) {
            span.recordException(res.error as any);
            span.setStatus({ code: SpanStatusCode.ERROR, message: res.error.message });
          }
          span.end();
          return res;
        },
      );

      if (eventError || !event) {
        rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: "Event not found" });
        rootSpan.setAttribute("http.status_code", 404);
        rootSpan.end();
        return new Response(JSON.stringify({ error: "Event not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (event.created_by !== user.id) {
        rootSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: "Forbidden: You do not own this event.",
        });
        rootSpan.setAttribute("http.status_code", 403);
        rootSpan.end();
        return new Response(JSON.stringify({ error: "Forbidden: You do not own this event." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (event.status === "cancelled") {
        rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: "Event is already cancelled." });
        rootSpan.setAttribute("http.status_code", 400);
        rootSpan.end();
        return new Response(JSON.stringify({ error: "Event is already cancelled." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Mark Event as Cancelled
      await tracer.startActiveSpan("supabase.update_event", async (span) => {
        span.setAttribute("db.system", "postgresql");
        span.setAttribute("db.operation", "UPDATE");
        span.setAttribute("db.sql.table", "events");
        const { error: updateEventError } = await supabase
          .from("events")
          .update({
            status: "cancelled",
            cancellation_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq("id", eventId);

        if (updateEventError) {
          span.recordException(updateEventError as any);
          span.setStatus({ code: SpanStatusCode.ERROR, message: updateEventError.message });
          throw updateEventError;
        }
        span.end();
      });

      // 4. Fetch all active RSVPs
      const rsvps = await tracer.startActiveSpan("supabase.fetch_rsvps", async (span) => {
        span.setAttribute("db.system", "postgresql");
        span.setAttribute("db.operation", "SELECT");
        span.setAttribute("db.sql.table", "event_rsvps");
        const { data, error } = await supabase
          .from("event_rsvps")
          .select("id, user_id, status, payment_intent_id, paid_amount_cents, profiles(email)")
          .eq("event_id", eventId)
          .in("status", ["attending", "approved", "waitlisted", "swapping"]);

        if (error) {
          span.recordException(error as any);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          throw error;
        }
        span.setAttribute("app.rsvp_count", data?.length || 0);
        span.end();
        return data;
      });

      let refundedCount = 0;
      let totalRefundedCents = 0;

      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
      const isMockStripe = !stripeSecretKey || stripeSecretKey.startsWith("mock-");
      const stripe = isMockStripe
        ? null
        : new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

      // 5. Iterate and process refunds / notifications
      await tracer.startActiveSpan("process_refunds_and_notifications", async (span) => {
        span.setAttribute("app.rsvps_to_process", rsvps?.length || 0);
        for (const rsvp of rsvps || []) {
          await tracer.startActiveSpan("process_single_rsvp", async (rsvpSpan) => {
            rsvpSpan.setAttribute("app.rsvp_id", rsvp.id);
            rsvpSpan.setAttribute("app.user_id", rsvp.user_id);

            // Mark RSVP as cancelled (invalidates ticket)
            await tracer.startActiveSpan("supabase.update_rsvp", async (dbSpan) => {
              dbSpan.setAttribute("db.system", "postgresql");
              dbSpan.setAttribute("db.operation", "UPDATE");
              dbSpan.setAttribute("db.sql.table", "event_rsvps");
              await supabase
                .from("event_rsvps")
                .update({ status: "cancelled", updated_at: new Date().toISOString() })
                .eq("id", rsvp.id);
              dbSpan.end();
            });

            let stripeRefundId = null;

            // Execute Stripe Refund if paid
            if (rsvp.paid_amount_cents > 0 && rsvp.payment_intent_id) {
              await tracer.startActiveSpan("stripe.refund", async (stripeSpan) => {
                stripeSpan.setAttribute("app.payment_intent_id", rsvp.payment_intent_id);
                stripeSpan.setAttribute("app.refund_amount_cents", rsvp.paid_amount_cents);

                if (isMockStripe) {
                  stripeRefundId = `re_mock_${crypto.randomUUID().replace(/-/g, "").substring(0, 24)}`;
                  stripeSpan.setAttribute("app.is_mock", true);
                } else {
                  try {
                    const refund = await stripe!.refunds.create({
                      payment_intent: rsvp.payment_intent_id,
                      amount: rsvp.paid_amount_cents,
                    });
                    stripeRefundId = refund.id;
                    stripeSpan.setAttribute("app.stripe_refund_id", stripeRefundId);
                  } catch (err: any) {
                    stripeSpan.recordException(err);
                    stripeSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
                    console.error(`Stripe refund failed for RSVP ${rsvp.id}:`, err);
                  }
                }
                stripeSpan.end();
              });

              if (stripeRefundId) {
                refundedCount++;
                totalRefundedCents += rsvp.paid_amount_cents;

                // Log refund
                await tracer.startActiveSpan("supabase.insert_refund_log", async (dbSpan) => {
                  dbSpan.setAttribute("db.system", "postgresql");
                  dbSpan.setAttribute("db.operation", "INSERT");
                  dbSpan.setAttribute("db.sql.table", "refund_logs");
                  await supabase.from("refund_logs").insert({
                    rsvp_id: rsvp.id,
                    payment_intent_id: rsvp.payment_intent_id,
                    refund_amount_cents: rsvp.paid_amount_cents,
                    stripe_refund_id: stripeRefundId,
                    refund_status: "completed",
                    refunded_at: new Date().toISOString(),
                  });
                  dbSpan.end();
                });
              }
            }

            // 6. Dispatch Notification / Email
            await tracer.startActiveSpan("supabase.insert_notification", async (dbSpan) => {
              dbSpan.setAttribute("db.system", "postgresql");
              dbSpan.setAttribute("db.operation", "INSERT");
              dbSpan.setAttribute("db.sql.table", "notifications");
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
              dbSpan.end();
              console.log(`[Email Dispatched] To: User ${rsvp.user_id} | Message: ${message}`);
            });

            rsvpSpan.end();
          });
        }
        span.end();
      });

      rootSpan.setAttribute("http.status_code", 200);
      rootSpan.setAttribute("app.refunded_count", refundedCount);
      rootSpan.setAttribute("app.total_refunded_cents", totalRefundedCents);
      rootSpan.setStatus({ code: SpanStatusCode.OK });
      rootSpan.end();

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
      rootSpan.recordException(err);
      rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      rootSpan.setAttribute("http.status_code", 500);
      rootSpan.end();

      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  });
});
