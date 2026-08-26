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

      // 4. Fetch ticket holders only. Waitlisted users are queried after refunds
      //    (Issue #4422) so they are not mixed into the ticket-holder path.
      const rsvps = await tracer.startActiveSpan("supabase.fetch_rsvps", async (span) => {
        span.setAttribute("db.system", "postgresql");
        span.setAttribute("db.operation", "SELECT");
        span.setAttribute("db.sql.table", "event_rsvps");
        const { data, error } = await supabase
          .from("event_rsvps")
          .select("id, user_id, status, payment_intent_id, paid_amount_cents, profiles(email)")
          .eq("event_id", eventId)
          .in("status", ["attending", "approved", "swapping"]);

        if (error) {
          span.recordException(error as any);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          throw error;
        }
        span.setAttribute("app.rsvp_count", data?.length || 0);
        span.end();
        return data;
      });

      let claimsCount = 0;
      let refundedCount = 0;
      let totalRefundedCents = 0;

      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
      const isMockStripe = !stripeSecretKey || stripeSecretKey.startsWith("mock-");
      const stripe = isMockStripe
        ? null
        : new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

      // 5. Create Cancellation Refund Claims (10% Bonus Platform Credit vs Card Refund)
      //    This avoids automatic Stripe transaction fees and retains platform capital (#4522).
      await tracer.startActiveSpan("process_cancellation_claims", async (span) => {
        span.setAttribute("app.rsvps_to_process", rsvps?.length || 0);
        for (const rsvp of rsvps || []) {
          await tracer.startActiveSpan("process_single_claim", async (rsvpSpan) => {
            rsvpSpan.setAttribute("app.rsvp_id", rsvp.id);
            rsvpSpan.setAttribute("app.user_id", rsvp.user_id);

            if (rsvp.paid_amount_cents > 0) {
              const bonusPercentage = 10;
              const bonusAmountCents = Math.round(rsvp.paid_amount_cents * (bonusPercentage / 100));
              const creditAmountCents = rsvp.paid_amount_cents + bonusAmountCents;

              // Create or update cancellation refund claim
              await tracer.startActiveSpan("supabase.insert_cancellation_claim", async (dbSpan) => {
                dbSpan.setAttribute("db.system", "postgresql");
                dbSpan.setAttribute("db.operation", "INSERT");
                dbSpan.setAttribute("db.sql.table", "cancellation_refund_claims");

                await supabase.from("cancellation_refund_claims").upsert({
                  event_id: eventId,
                  rsvp_id: rsvp.id,
                  user_id: rsvp.user_id,
                  original_amount_cents: rsvp.paid_amount_cents,
                  bonus_percentage: bonusPercentage,
                  credit_amount_cents: creditAmountCents,
                  status: "pending_choice",
                  created_at: new Date().toISOString(),
                }, { onConflict: "rsvp_id" });

                claimsCount++;
                dbSpan.end();
              });
            }

            rsvpSpan.end();
          });
        }
        span.end();
      });

      // 6. After registering claims, query waitlisted users, bulk-cancel
      //    them, and send the waitlist-specific cancellation email (#4422).
      const waitlisted = await tracer.startActiveSpan("supabase.fetch_waitlisted", async (span) => {
        span.setAttribute("db.system", "postgresql");
        span.setAttribute("db.operation", "SELECT");
        span.setAttribute("db.sql.table", "event_rsvps");
        const { data, error } = await supabase
          .from("event_rsvps")
          .select("id, user_id")
          .eq("event_id", eventId)
          .eq("status", "waitlisted");

        if (error) {
          span.recordException(error as any);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          throw error;
        }
        span.setAttribute("app.waitlisted_count", data?.length || 0);
        span.end();
        return data;
      });

      await tracer.startActiveSpan("supabase.bulk_cancel_waitlist", async (span) => {
        span.setAttribute("db.system", "postgresql");
        span.setAttribute("db.operation", "UPDATE");
        span.setAttribute("db.sql.table", "event_rsvps");
        const { error } = await supabase
          .from("event_rsvps")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("event_id", eventId)
          .eq("status", "waitlisted");

        if (error) {
          span.recordException(error as any);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          throw error;
        }
        span.setAttribute("app.waitlisted_cleared", waitlisted?.length || 0);
        span.end();
      });

      const waitlistMessage =
        "The event you were waitlisted for has been completely cancelled. You have been removed from the queue.";

      await tracer.startActiveSpan("dispatch_waitlist_cancellation_emails", async (span) => {
        span.setAttribute("app.waitlisted_count", waitlisted?.length || 0);
        for (const entry of waitlisted || []) {
          await tracer.startActiveSpan("supabase.insert_waitlist_notification", async (dbSpan) => {
            dbSpan.setAttribute("db.system", "postgresql");
            dbSpan.setAttribute("db.operation", "INSERT");
            dbSpan.setAttribute("db.sql.table", "notifications");
            await supabase.from("notifications").insert({
              user_id: entry.user_id,
              type: "waitlist_cancelled",
              title: `Event Cancelled: ${event.title}`,
              message: waitlistMessage,
              link: "/events",
            });
            dbSpan.end();
          });
          console.log(`[Email Dispatched] To: User ${entry.user_id} | Message: ${waitlistMessage}`);
        }
        span.end();
      });

      // 7. Invalidate ticket-holder RSVPs and dispatch choice notification / email (#4522).
      await tracer.startActiveSpan("process_ticket_holder_cancellations", async (span) => {
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

            // Dispatch Choice Notification / Email
            await tracer.startActiveSpan("supabase.insert_notification", async (dbSpan) => {
              dbSpan.setAttribute("db.system", "postgresql");
              dbSpan.setAttribute("db.operation", "INSERT");
              dbSpan.setAttribute("db.sql.table", "notifications");

              let message = `The event "${event.title}" was cancelled (${reason}).`;
              let notificationType = "event_cancelled";
              let link = "/events";

              if (rsvp.paid_amount_cents > 0) {
                const cardDollars = (rsvp.paid_amount_cents / 100).toFixed(2);
                const bonusPercentage = 10;
                const bonusAmountCents = Math.round(rsvp.paid_amount_cents * (bonusPercentage / 100));
                const creditDollars = ((rsvp.paid_amount_cents + bonusAmountCents) / 100).toFixed(2);

                message = `Event Cancelled. Choose your refund: 1) Full Refund to Card ($${cardDollars}). 2) $${creditDollars} in CampusConnect Credit (10% Bonus).`;
                notificationType = "event_cancellation_refund_choice";
                link = `/events/refund-choice?event_id=${eventId}&rsvp_id=${rsvp.id}`;
              }

              await supabase.from("notifications").insert({
                user_id: rsvp.user_id,
                type: notificationType,
                title: `Event Cancelled: ${event.title}`,
                message,
                link,
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
      rootSpan.setAttribute("app.claims_count", claimsCount);
      rootSpan.setAttribute("app.refunded_count", refundedCount);
      rootSpan.setAttribute("app.total_refunded_cents", totalRefundedCents);
      rootSpan.setAttribute("app.waitlisted_cleared", waitlisted?.length || 0);
      rootSpan.setStatus({ code: SpanStatusCode.OK });
      rootSpan.end();

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully cancelled event and dispatched refund choices for ${claimsCount} paid attendees.`,
          claimsCount,
          total_claims_created: claimsCount,
          total_rsvps_cancelled: (rsvps?.length || 0) + (waitlisted?.length || 0),
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
