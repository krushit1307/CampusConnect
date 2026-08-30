// Edge Function: Place Layout Bid
// Description: Handles placing a bid on an interactive layout table node, including Stripe card authorization.

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
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { event_id, sponsorship_id, table_node_id, bid_amount, logo_url, target_link_url } =
      await req.json();
    if (!event_id || !sponsorship_id || !table_node_id || !bid_amount || bid_amount <= 0) {
      throw new Error("Invalid bid parameters.");
    }

    // 1. Create SetupIntent on Stripe to authorize the card off-session later
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
      metadata: {
        user_id: user.id,
        event_id,
        sponsorship_id,
        table_node_id,
        bid_amount: bid_amount.toString(),
        type: "layout_bid",
      },
    });

    // 2. Call RPC to process the database transaction
    const { data: bidResult, error: bidError } = await supabase.rpc("place_sponsor_table_bid", {
      p_event_id: event_id,
      p_sponsorship_id: sponsorship_id,
      p_table_node_id: table_node_id,
      p_bid_amount: bid_amount,
      p_logo_url: logo_url || "",
      p_target_link_url: target_link_url || "",
      p_setup_intent_id: setupIntent.id,
    });

    if (bidError) {
      throw new Error(bidError.message);
    }

    // 3. Send email alert if someone was outbid
    if (bidResult && bidResult.outbid_email) {
      const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
      const verifiedSender =
        Deno.env.get("SENDGRID_VERIFIED_SENDER") || "no-reply@campusconnect.app";

      if (sendgridApiKey) {
        const sendgridPayload = {
          personalizations: [
            {
              to: [{ email: bidResult.outbid_email }],
              dynamic_template_data: {
                table_node_id,
                bid_amount: bid_amount.toString(),
                event_link: `https://campusconnect.app/events/${event_id}/floorplan`,
              },
            },
          ],
          from: { email: verifiedSender },
          template_id: "d-outbid-alert-template-id", // mock template ID
        };

        await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sendgridApiKey}`,
          },
          body: JSON.stringify(sendgridPayload),
        });
      } else {
        console.log(
          `[SendGrid Simulation] Outbid Alert sent to ${bidResult.outbid_email} for Table ${table_node_id}`,
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        clientSecret: setupIntent.client_secret,
        bidId: bidResult.bid_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("Layout Bidding Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
