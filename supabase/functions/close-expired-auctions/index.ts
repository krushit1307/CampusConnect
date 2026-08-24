import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, serviceRoleKey);
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(stripeSecret, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});
const appUrl = Deno.env.get("APP_URL") || "https://campusconnect.app";

function isAuthorized(req: Request): boolean {
  const authorization = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("AUCTION_CRON_SECRET");
  return Boolean(
    (serviceRoleKey && authorization === `Bearer ${serviceRoleKey}`) ||
    (cronSecret && req.headers.get("x-auction-cron-secret") === cronSecret),
  );
}

async function closeExpiredAuctions() {
  const now = new Date().toISOString();
  const { data: expiredItems, error: auctionError } = await supabase
    .from("auction_items")
    .select("id, event_id, title, end_time")
    .eq("is_closed", false)
    .lt("end_time", now)
    .limit(100);

  if (auctionError)
    throw new Error(`Failed to fetch expired auction items: ${auctionError.message}`);

  let closed = 0;
  let checkoutLinksCreated = 0;

  for (const item of expiredItems ?? []) {
    const { data: closeResult, error: closeError } = await supabase.rpc("close_silent_auction", {
      p_item_id: item.id,
    });
    if (closeError) {
      console.error(`[Auction Close] Failed to close ${item.id}:`, closeError);
      continue;
    }

    const result = closeResult?.[0];
    if (!result?.success) continue;
    closed += 1;

    if (!result.winner_id) continue;

    const { data: winner, error: winnerError } = await supabase
      .from("auction_winners")
      .select("id, winner_user_id, winning_bid, stripe_checkout_url, stripe_checkout_session_id")
      .eq("item_id", item.id)
      .maybeSingle();
    if (winnerError || !winner || winner.stripe_checkout_url) continue;

    const { data: winnerUser } = await supabase.auth.admin.getUserById(winner.winner_user_id);
    const metadata = {
      type: "auction_winner",
      auction_winner_id: winner.id,
      auction_item_id: item.id,
      event_id: item.event_id,
      winner_user_id: winner.winner_user_id,
    };

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `Silent auction: ${item.title}` },
              unit_amount: winner.winning_bid,
            },
            quantity: 1,
          },
        ],
        customer_email: winnerUser.user?.email || undefined,
        success_url: `${appUrl}/events/${item.event_id}?auction_payment=success&auction_item=${item.id}`,
        cancel_url: `${appUrl}/events/${item.event_id}?auction_payment=cancelled&auction_item=${item.id}`,
        metadata,
      });

      if (!session.url) continue;
      const { error: updateError } = await supabase
        .from("auction_winners")
        .update({ stripe_checkout_url: session.url, stripe_checkout_session_id: session.id })
        .eq("id", winner.id)
        .is("stripe_checkout_url", null);
      if (updateError) {
        console.error(
          `[Auction Close] Failed to store checkout for winner ${winner.id}:`,
          updateError,
        );
      } else {
        checkoutLinksCreated += 1;
      }
    } catch (stripeError) {
      console.error(
        `[Auction Close] Failed to create checkout for winner ${winner.id}:`,
        stripeError,
      );
    }
  }

  return { closed, checkoutLinksCreated };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-auction-cron-secret, content-type",
      },
    });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!isAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  if (!serviceRoleKey || !stripeSecret)
    return new Response("Server configuration error", { status: 500 });

  try {
    const result = await closeExpiredAuctions();
    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Auction Close] Sweep failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
