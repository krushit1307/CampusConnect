import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(stripeSecret, {
  apiVersion: "2023-10-16",
});

async function closeExpiredAuctions() {
  // 1. Find all ended, un-closed auctions
  const { data: expiredAuctions, error: auctionError } = await supabase
    .from("ad_auctions")
    .select("id, event_id, placement")
    .lt("end_time", new Date().toISOString())
    .eq("is_closed", false);

  if (auctionError || !expiredAuctions) {
    console.error("Error fetching expired auctions:", auctionError);
    return;
  }

  for (const auction of expiredAuctions) {
    // 2. Fetch the top bidder information from the ledger
    const { data: winningBid, error: bidError } = await supabase
      .from("bids")
      .select("sponsor_id, amount, sponsor_name")
      .eq("auction_id", auction.id)
      .order("amount", { ascending: false })
      .limit(1)
      .single();

    if (winningBid) {
      // 3. Resolve the sponsor's email & Stripe metadata
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, stripe_customer_id")
        .eq("id", winningBid.sponsor_id)
        .single();

      if (profile?.email && profile?.stripe_customer_id) {
        // 4. Generate the direct Stripe invoice (Integration with issue #3274)
        try {
          await stripe.invoiceItems.create({
            customer: profile.stripe_customer_id,
            amount: Math.round(winningBid.amount * 100), // convert to cents
            currency: "usd",
            description: `Winning Bid: ${auction.placement.toUpperCase()} placement slot for Event ID: ${auction.event_id}`,
          });

          await stripe.invoices.create({
            customer: profile.stripe_customer_id,
            auto_advance: true, // Auto-finalize and email out the payment link
            description: `Dynamic Auction Billing Settlement`,
          });
        } catch (stripeErr) {
          console.error(`Stripe billing error for auction ${auction.id}:`, stripeErr);
        }
      }
    }

    // 5. Explicitly flag the auction as closed out to bypass next sweep
    await supabase.from("ad_auctions").update({ is_closed: true }).eq("id", auction.id);
  }
}

serve(async (req) => {
  // Can be triggered by pg_cron HTTP request or standard cron trigger
  try {
    await closeExpiredAuctions();
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
