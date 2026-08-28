// =============================================================================
// Edge Function: Create Campaign Donation Checkout Session
// Feature: Crowdfunding / Goal Progress Bar for Clubs
// Description: Creates a Stripe Checkout session for a one-off donation
// explicitly linked to a crowdfunding_campaigns.id via metadata. The actual
// campaign_donations row is only ever written by the payment-webhook once
// Stripe confirms the charge succeeded — this function never touches
// current_amount_cents directly.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";
import { rateLimiter } from "../shared/rateLimiter.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_DONATION_CENTS = 100; // $1.00
const MAX_DONATION_CENTS = 100_000_00; // $100,000.00 sanity cap

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const limited = await rateLimiter(req, "create-campaign-donation-checkout", 20, 60);
  if (limited) return limited;

  try {
    // 1. Authenticate (donors must be signed in; anonymity only hides their
    // name from the public leaderboard, it does not allow anonymous payment).
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

    // 2. Parse & validate request
    const { campaignId, amountCents, isAnonymous, matchId: requestedMatchId } = await req.json();
    const matchId = typeof requestedMatchId === "string" ? requestedMatchId : undefined;

    if (!campaignId || typeof campaignId !== "string") {
      throw new Error("Missing campaignId");
    }
    if (
      !Number.isInteger(amountCents) ||
      amountCents < MIN_DONATION_CENTS ||
      amountCents > MAX_DONATION_CENTS
    ) {
      throw new Error(
        `Donation amount must be between $${MIN_DONATION_CENTS / 100} and $${MAX_DONATION_CENTS / 100}`,
      );
    }

    // 3. Fetch campaign & club, ensure it's still accepting donations
    const { data: campaign, error: campaignError } = await supabase
      .from("crowdfunding_campaigns")
      .select("id, title, status, end_date, club_id, clubs(name)")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) throw new Error("Campaign not found");
    if (campaign.status !== "active")
      throw new Error("This campaign is no longer accepting donations");
    if (campaign.end_date && new Date(campaign.end_date).getTime() < Date.now()) {
      throw new Error("This campaign has ended");
    }

    if (matchId) {
      const { data: invitation, error: invitationError } = await supabase
        .rpc("get_campaign_match_invitation", { p_match_id: matchId })
        .maybeSingle();

      if (
        invitationError ||
        !invitation ||
        invitation.campaign_id !== campaignId ||
        invitation.requested_amount_cents !== amountCents
      ) {
        throw new Error(
          "This alumni match invitation is invalid, expired, or has a different amount.",
        );
      }
    }

    // 4. Look up a display name snapshot for the leaderboard (ignored if anonymous)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, handle")
      .eq("id", user.id)
      .maybeSingle();

    const displayName = profile?.full_name || profile?.handle || "A generous donor";
    const clubName =
      (campaign as unknown as { clubs?: { name?: string } }).clubs?.name ?? "this club";

    // 5. Create the Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Donation to "${campaign.title}"`,
              description: `Supporting ${clubName} on CampusConnect`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${req.headers.get("origin")}/clubs/${campaign.club_id}?donation=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/clubs/${campaign.club_id}?donation=cancelled`,
      metadata: {
        type: "campaign_donation",
        campaign_id: campaignId,
        donor_id: user.id,
        display_name: displayName,
        is_anonymous: String(Boolean(isAnonymous)),
        ...(matchId ? { match_id: matchId } : {}),
      },
    });

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CampaignDonationCheckout] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
