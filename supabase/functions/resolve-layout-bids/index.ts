// Edge Function: Resolve Layout Bids
// Description: Scheduled or on-demand resolution of layout bids after bidding deadline.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Fetch all events past layout bidding deadline that still have active bids
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, title, layout_bidding_deadline")
      .lte("layout_bidding_deadline", new Date().toISOString());

    if (eventsError) throw eventsError;

    let totalResolved = 0;

    for (const event of events || []) {
      // Find active bids for this event
      const { data: bids, error: bidsError } = await supabase
        .from("sponsor_table_bids")
        .select("*, corporate_sponsorships(sponsor_user_id)")
        .eq("event_id", event.id)
        .eq("status", "active");

      if (bidsError) continue;

      for (const bid of bids || []) {
        try {
          let paymentIntentId = "mock_intent_id";

          // 2. Capture Stripe Payment using SetupIntent
          if (bid.stripe_setup_intent_id && Deno.env.get("STRIPE_SECRET_KEY")) {
            const setupIntent = await stripe.setupIntents.retrieve(bid.stripe_setup_intent_id);
            const paymentMethodId = setupIntent.payment_method as string;

            if (paymentMethodId) {
              const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(Number(bid.winning_bid_amount) * 100),
                currency: "usd",
                payment_method: paymentMethodId,
                off_session: true,
                confirm: true,
                description: `Booth Bidding Winner: Event ${event.title}, Table ${bid.table_node_id}`,
              });
              paymentIntentId = paymentIntent.id;
            }
          }

          // 3. Assign sponsor to floorplan node
          const sponsorId = bid.corporate_sponsorships?.sponsor_user_id || "";
          await supabase.rpc("assign_sponsor_to_table_node", {
            p_event_id: event.id,
            p_table_node_id: bid.table_node_id,
            p_sponsor_id: sponsorId,
            p_company_name: bid.company_name,
          });

          // 4. Mark bid as completed
          await supabase
            .from("sponsor_table_bids")
            .update({ status: "completed", payment_intent_id: paymentIntentId })
            .eq("id", bid.id);

          totalResolved++;
        } catch (err: any) {
          console.error(`Failed to resolve bid ${bid.id}:`, err.message);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, resolved_count: totalResolved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Resolve Layout Bids Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
