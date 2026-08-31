import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { broadcastTicketPurchased } from "../_shared/ticketPurchasedBroadcast.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  try {
    const payload = await req.json();

    // MOCK: In a real app, this would be a Stripe Event verification.
    // We expect { type: 'checkout.session.completed', data: { metadata: { seatIds: '...', orderId: '...' } } }

    if (payload.type === "checkout.session.completed") {
      const metadata = payload.data.metadata || {};

      if (metadata.type === "bundle") {
        // Forward bundle requests to process-bundle-checkout edge function
        const functionUrl = `${supabaseUrl}/functions/v1/process-bundle-checkout`;
        const res = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ sessionId: payload.data.id }),
        });

        if (!res.ok) {
          const errorData = await res.text();
          console.error("Error calling process-bundle-checkout:", errorData);
          throw new Error("Bundle checkout processing failed");
        }
      } else if (metadata.seatIds || (metadata.event_id && metadata.user_id && metadata.tier_id)) {
        // Handle seat/ticket purchases
        const orderId = metadata.orderId;
        const eventId = metadata.event_id;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        let confirmError = null;

        if (metadata.seatIds) {
          const seatIds = metadata.seatIds.split(",");
          // Call RPC to confirm seat checkout
          const { error } = await supabase.rpc("confirm_seat_purchase", {
            p_seat_ids: seatIds,
            p_order_id: orderId,
          });
          confirmError = error;
        } else if (metadata.event_id && metadata.user_id && metadata.tier_id) {
          // Standard ticket purchase logic that should have been here
          const { error } = await supabase.from("event_rsvps").insert({
            event_id: metadata.event_id,
            user_id: metadata.user_id,
            ticket_tier_id: metadata.tier_id,
            status: "PAID",
          });
          confirmError = error;
        }

        if (confirmError) {
          console.error("RPC/Insert Error:", confirmError);
          throw confirmError;
        }

        if (eventId) {
          try {
            const { data: event } = await supabase
              .from("events")
              .select("available_spots, max_attendees")
              .eq("id", eventId)
              .maybeSingle();
            const remaining = event?.available_spots ?? event?.max_attendees ?? 0;
            await broadcastTicketPurchased(supabase, eventId, remaining, metadata.user_id);
          } catch (broadcastError) {
            console.error("[ticket_purchased] broadcast failed:", broadcastError);
          }
        }

        // --- TRACK SALES VELOCITY FOR SURGE PRICING ---
        if (eventId) {
          try {
            const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
            const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
            if (redisUrl && redisToken) {
              // We use dynamic import for Redis to keep it isolated
              const { Redis } = await import("https://esm.sh/@upstash/redis@1.30.0");
              const redis = new Redis({ url: redisUrl, token: redisToken });

              const now = Date.now();
              const key = `sales_velocity:${eventId}`;

              // We add a unique entry for this purchase. Use the stripe session id or just a random UUID to avoid collisions
              const memberId = payload.data.id || crypto.randomUUID();

              await redis.zadd(key, { score: now, member: memberId });

              // Set an expiry on the key itself to prevent infinite buildup of dead keys
              // 60 seconds + a little buffer
              await redis.expire(key, 120);

              console.log(`[Surge Tracking] Added purchase ${memberId} to ${key} at ${now}`);
            }
          } catch (redisErr) {
            console.error("[Surge Tracking] Failed to track sales velocity:", redisErr);
          }
        }
        // ----------------------------------------------
      }
    } else if (payload.type === "invoice.paid") {
      const invoice = payload.data.object;
      const stripeInvoiceId = invoice.id;

      console.log(
        `[Stripe Webhook] Received invoice.paid event for Stripe Invoice ID: ${stripeInvoiceId}`,
      );

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch the sponsor_invoices record matching this stripeInvoiceId
      const { data: sponsorInvoice, error: errInvoice } = await supabase
        .from("sponsor_invoices")
        .select("id, pitch_id, amount_cents")
        .eq("stripe_invoice_id", stripeInvoiceId)
        .single();

      if (errInvoice || !sponsorInvoice) {
        console.error(`Sponsor invoice not found for Stripe ID ${stripeInvoiceId}:`, errInvoice);
        throw new Error("Sponsor invoice not found");
      }

      // Update the sponsor_invoices status to 'paid'
      const { error: errUpdateInvoice } = await supabase
        .from("sponsor_invoices")
        .update({ status: "paid" })
        .eq("id", sponsorInvoice.id);

      if (errUpdateInvoice) {
        console.error("Failed to update sponsor_invoices status to paid:", errUpdateInvoice);
        throw errUpdateInvoice;
      }

      // Update the pitch status to 'Funds Received'
      const { data: pitch, error: errUpdatePitch } = await supabase
        .from("sponsor_pitches")
        .update({ status: "Funds Received" })
        .eq("id", sponsorInvoice.pitch_id)
        .select(
          `
          id,
          request_id,
          sponsorship_campaigns (
            company_name
          ),
          funding_requests (
            club_id
          )
        `,
        )
        .single();

      if (errUpdatePitch || !pitch) {
        console.error("Failed to update sponsor_pitches status to Funds Received:", errUpdatePitch);
        throw errUpdatePitch;
      }

      // Insert credit transaction into club_transactions
      const clubId = pitch.funding_requests?.club_id;
      const companyName = pitch.sponsorship_campaigns?.company_name || "Sponsor";
      const amountDollars = (sponsorInvoice.amount_cents / 100.0).toFixed(2);

      if (clubId) {
        const { error: errTx } = await supabase.from("club_transactions").insert({
          club_id: clubId,
          amount: parseFloat(amountDollars),
          transaction_type: "INCOME",
          category: "Sponsorship",
          description: `Sponsorship Funds Received from ${companyName}`,
        });

        if (errTx) {
          console.error("Failed to insert club credit transaction:", errTx);
          throw errTx;
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
