import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      } else if (metadata.seatIds) {
        // Handle seat purchases
        const seatIds = metadata.seatIds.split(",");
        const orderId = metadata.orderId;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Call RPC to confirm
        const { error } = await supabase.rpc("confirm_seat_purchase", {
          p_seat_ids: seatIds,
          p_order_id: orderId,
        });

        if (error) {
          console.error("RPC Error:", error);
          throw error;
        }
      }
    } else if (payload.type === "invoice.paid") {
      const invoice = payload.data.object;
      const stripeInvoiceId = invoice.id;
      
      console.log(`[Stripe Webhook] Received invoice.paid event for Stripe Invoice ID: ${stripeInvoiceId}`);

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
        .select(`
          id,
          request_id,
          sponsorship_campaigns (
            company_name
          ),
          funding_requests (
            club_id
          )
        `)
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
        const { error: errTx } = await supabase
          .from("club_transactions")
          .insert({
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
