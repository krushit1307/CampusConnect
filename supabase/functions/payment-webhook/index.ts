import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";
import { rateLimiter } from "../shared/rateLimiter.ts";
import { signTicket } from "../_shared/ticket-crypto.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const stripeSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || Deno.env.get("WEBHOOK_SECRET") || "";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, stripe-signature",
      },
    });
  }

  const limited = await rateLimiter(req, "payment-webhook", 30, 60);
  if (limited) return limited;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signatureHeader = req.headers.get("stripe-signature");
  if (!signatureHeader) {
    return new Response("Missing signature header", { status: 400 });
  }

  try {
    const rawBody = await req.text();

    if (!stripeSecret) {
      console.error("[Config Error] STRIPE_WEBHOOK_SECRET is missing.");
      return new Response("Server configuration error", { status: 500 });
    }

    // 1. Cryptographically verify webhook signature using Stripe SDK
    let stripeEvent;
    try {
      stripeEvent = await stripe.webhooks.constructEventAsync(
        rawBody,
        signatureHeader,
        stripeSecret,
      );
    } catch (err: any) {
      console.warn("[Security Alert] Cryptographic signature mismatch:", err.message);
      return new Response("Invalid signature payload", { status: 400 });
    }

    const eventId = stripeEvent.id;

    if (!eventId) {
      return new Response("Missing event ID in body", { status: 400 });
    }

    // 2. Initialize Supabase client with admin service role key to bypass RLS limits
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Enforce Idempotency: check if webhook has already been processed
    const { data: existingWebhook, error: checkError } = await supabase
      .from("processed_webhooks")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (checkError) {
      console.error("[DB Error] Failed to lookup processed webhooks:", checkError);
      return new Response("Database lookup error", { status: 500 });
    }

    if (existingWebhook) {
      console.log(`[Webhook Ingestion] Event ${eventId} has already been processed. Skipping.`);
      return new Response(
        JSON.stringify({ status: "skipped", message: "Duplicate webhook event." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 4. Insert idempotency lock record to prevent duplicate race conditions
    const { error: insertLockError } = await supabase
      .from("processed_webhooks")
      .insert({ event_id: eventId, provider: "stripe" });

    if (insertLockError) {
      console.error("[DB Error] Failed to write idempotency lock:", insertLockError);
      return new Response("Idempotency insert lock failed", { status: 500 });
    }

    // 5. Check completed status and update event_rsvps table status to 'PAID'
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      // 5a. Silent auction winner payment
      if (session.metadata?.type === "auction_winner") {
        const winnerId = session.metadata?.auction_winner_id;
        const winnerUserId = session.metadata?.winner_user_id;
        if (!winnerId || !winnerUserId) {
          return new Response("Missing auction winner metadata", { status: 400 });
        }

        const { data: winner, error: winnerError } = await supabase
          .from("auction_winners")
          .select("id, winner_user_id, winning_bid, payment_status")
          .eq("id", winnerId)
          .maybeSingle();
        if (
          winnerError ||
          !winner ||
          winner.winner_user_id !== winnerUserId ||
          winner.payment_status !== "pending" ||
          (session.amount_total ?? 0) !== winner.winning_bid
        ) {
          console.error(`[Webhook Ingestion] Invalid auction winner payment ${winnerId}.`);
          return new Response("Invalid auction winner payment", { status: 400 });
        }

        const { error: winnerUpdateError } = await supabase
          .from("auction_winners")
          .update({ payment_status: "paid" })
          .eq("id", winnerId)
          .eq("payment_status", "pending");
        if (winnerUpdateError) {
          console.error(
            `[DB Error] Failed to mark auction winner ${winnerId} paid:`,
            winnerUpdateError,
          );
          return new Response("Failed to record auction payment", { status: 500 });
        }

        console.log(`[Webhook Ingestion] Marked auction winner ${winnerId} as paid.`);
        return new Response(JSON.stringify({ status: "success", eventId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 5b. Crowdfunding campaign donation
      if (session.metadata?.type === "campaign_donation") {
        const campaignId = session.metadata?.campaign_id;
        if (!campaignId) {
          console.warn("[Webhook Ingestion] Missing metadata campaign_id parameter.");
          return new Response("Missing campaign_id metadata parameter", { status: 400 });
        }

        const isAnonymous = session.metadata?.is_anonymous === "true";
        const amountCents = session.amount_total ?? 0;
        const matchId = session.metadata?.match_id;

        // Validate the one-time invitation before recording the payment. Checkout
        // already performs this check, but the webhook must not trust metadata.
        if (matchId) {
          const { data: invitation, error: invitationError } = await supabase
            .from("campaign_donation_matches")
            .select("id, campaign_id, alumni_user_id, requested_amount_cents, status")
            .eq("id", matchId)
            .eq("status", "invited")
            .maybeSingle();

          if (
            invitationError ||
            !invitation ||
            invitation.campaign_id !== campaignId ||
            invitation.alumni_user_id !== session.metadata?.donor_id ||
            invitation.requested_amount_cents !== amountCents
          ) {
            console.error(`[Webhook Ingestion] Invalid campaign donation match ${matchId}.`);
            return new Response("Invalid campaign donation match", { status: 400 });
          }
        }

        // Insert as 'succeeded' directly — the campaign_donation_delta trigger
        // increments crowdfunding_campaigns.current_amount_cents automatically.
        const { data: donation, error: insertDonationError } = await supabase
          .from("campaign_donations")
          .insert({
            campaign_id: campaignId,
            donor_id: session.metadata?.donor_id || null,
            display_name: isAnonymous ? null : session.metadata?.display_name || null,
            is_anonymous: isAnonymous,
            amount_cents: amountCents,
            currency: session.currency ?? "usd",
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
            status: "succeeded",
          })
          .select("id")
          .single();

        if (insertDonationError || !donation) {
          console.error(
            `[DB Error] Failed to record donation for campaign ${campaignId}:`,
            insertDonationError,
          );
          return new Response("Failed to record campaign donation", { status: 500 });
        }

        if (matchId) {
          const { error: linkError } = await supabase.rpc("link_campaign_donation_match", {
            p_match_id: matchId,
            p_donation_id: donation.id,
          });
          if (linkError) {
            console.error(`[DB Error] Failed to link alumni match ${matchId}:`, linkError);
          }
        } else {
          const { data: matches, error: matchError } = await supabase.rpc(
            "create_campaign_donation_matches",
            { p_donation_id: donation.id, p_pool_size: 10 },
          );
          if (matchError) {
            console.error(
              `[DB Error] Failed to create alumni matches for donation ${donation.id}:`,
              matchError,
            );
          } else if (matches && matches.length > 0) {
            const notificationPromise = supabase.functions.invoke("notify-alumni-donation-match", {
              body: { sourceDonationId: donation.id },
            });
            const handleNotificationResult = async () => {
              const { error: notificationError } = await notificationPromise;
              if (notificationError) {
                console.error(
                  `[Notification Error] Failed to notify alumni for donation ${donation.id}:`,
                  notificationError,
                );
              }
            };

            if (typeof EdgeRuntime !== "undefined") {
              EdgeRuntime.waitUntil(handleNotificationResult());
            } else {
              await handleNotificationResult();
            }
          }
        }

        console.log(
          `[Webhook Ingestion] Recorded $${(amountCents / 100).toFixed(2)} donation to campaign ${campaignId}.`,
        );

        return new Response(JSON.stringify({ status: "success", eventId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 5b. Event ticket RSVP
      const rsvpId = session.metadata?.rsvp_id;

      if (rsvpId) {
        const { error: updateRsvpError } = await supabase
          .from("event_rsvps")
          .update({ status: "PAID" })
          .eq("id", rsvpId);

        if (updateRsvpError) {
          console.error(`[DB Error] Failed to update RSVP ${rsvpId} to PAID:`, updateRsvpError);
          return new Response("Failed to update RSVP status", { status: 500 });
        }
        console.log(`[Webhook Ingestion] Successfully set RSVP ${rsvpId} status to PAID.`);

        // Decentralized Ticketing: Sign the ticket
        try {
          const { data: rsvpData } = await supabase
            .from("event_rsvps")
            .select("ticket_id, event_id, user_id, version")
            .eq("id", rsvpId)
            .single();

          if (rsvpData?.user_id && rsvpData?.ticket_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("public_key")
              .eq("id", rsvpData.user_id)
              .single();

            if (profile?.public_key) {
              const signature = await signTicket(
                rsvpData.ticket_id,
                rsvpData.event_id,
                profile.public_key,
                rsvpData.version || 1,
              );

              await supabase
                .from("event_rsvps")
                .update({
                  owner_public_key: profile.public_key,
                  signature: signature,
                })
                .eq("id", rsvpId);
            }
          }
        } catch (cryptoErr) {
          console.error("Failed to sign ticket in webhook:", cryptoErr);
        }
      } else if (
        session.metadata?.tier_id &&
        session.metadata?.event_id &&
        session.metadata?.user_id
      ) {
        // Dynamic Pricing Tiers (Issue #3293)
        // Record the purchased ticket tier and price
        const { error: insertRsvpError } = await supabase.from("event_rsvps").insert({
          event_id: session.metadata.event_id,
          user_id: session.metadata.user_id,
          status: "PAID",
          ticket_tier_id: session.metadata.tier_id,
          paid_amount_cents: session.amount_total ?? 0,
          payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        });

        if (insertRsvpError) {
          console.error(`[DB Error] Failed to insert RSVP for dynamic tier:`, insertRsvpError);
          return new Response("Failed to insert RSVP", { status: 500 });
        }
        console.log(
          `[Webhook Ingestion] Successfully recorded RSVP for tier ${session.metadata.tier_id}.`,
        );

        // Decentralized Ticketing: Sign the new ticket
        try {
          // Get the inserted row to get the ticket_id
          const { data: rsvpData } = await supabase
            .from("event_rsvps")
            .select("id, ticket_id, version")
            .match({ event_id: session.metadata.event_id, user_id: session.metadata.user_id })
            .single();

          if (rsvpData?.ticket_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("public_key")
              .eq("id", session.metadata.user_id)
              .single();

            if (profile?.public_key) {
              const signature = await signTicket(
                rsvpData.ticket_id,
                session.metadata.event_id,
                profile.public_key,
                rsvpData.version || 1,
              );

              await supabase
                .from("event_rsvps")
                .update({
                  owner_public_key: profile.public_key,
                  signature: signature,
                })
                .eq("id", rsvpData.id);
            }
          }
        } catch (cryptoErr) {
          console.error("Failed to sign dynamically priced ticket in webhook:", cryptoErr);
        }
      } else {
        console.warn("[Webhook Ingestion] Missing rsvp_id or tier_id metadata parameter.");
        return new Response("Missing rsvp_id or tier_id metadata parameter", { status: 400 });
      }

      // 6. Handle Micro-Donation splitting (Issue #2876)
      if (
        session.metadata?.include_charity_donation === "true" ||
        session.metadata?.include_charity_donation === true
      ) {
        console.log(
          `[Webhook Ingestion] Detected Charity Donation. Fetching line items for Session ${session.id}...`,
        );

        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          const charityItem = lineItems.data.find(
            (item: any) =>
              item.description?.toLowerCase().includes("charity") ||
              item.price?.product_data?.name?.toLowerCase().includes("charity"),
          );

          if (charityItem) {
            const donationAmount = charityItem.amount_total;
            const { error: charityError } = await supabase.from("charity_ledger").insert({
              user_id: session.metadata.user_id || null, // Assuming you passed user_id in metadata
              event_id: session.metadata.event_id || null, // Assuming you passed event_id in metadata
              stripe_session_id: session.id,
              donation_amount_cents: donationAmount,
            });

            if (charityError) {
              console.error("[DB Error] Failed to insert into charity_ledger:", charityError);
              // Consider whether to fail the whole webhook or just log it
            } else {
              console.log(
                `[Webhook Ingestion] Successfully recorded $${(donationAmount / 100).toFixed(2)} to charity_ledger.`,
              );
            }
          } else {
            console.warn(
              `[Webhook Ingestion] include_charity_donation flag was true, but no Charity line item found for session ${session.id}`,
            );
          }
        } catch (err: any) {
          console.error(
            `[Stripe API Error] Failed to fetch line items for session ${session.id}:`,
            err.message,
          );
        }
      }
    }

    // 6. Refunds / disputes on a donation charge must decrement current_amount_cents
    // so the progress bar stays mathematically accurate. We resolve the donation
    // row by payment_intent_id (present on both charge.refunded and
    // charge.dispute.created payloads) rather than trusting client-supplied state.
    if (stripeEvent.type === "charge.refunded" || stripeEvent.type === "charge.dispute.created") {
      // Both a Stripe Charge (charge.refunded) and a Stripe Dispute
      // (charge.dispute.created) payload carry a payment_intent field.
      const eventObject = stripeEvent.data.object as { payment_intent?: string | null };
      const paymentIntentId = eventObject.payment_intent;

      if (!paymentIntentId) {
        console.warn("[Webhook Ingestion] Refund/dispute event missing payment_intent.");
        return new Response(JSON.stringify({ status: "ignored", eventId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const newStatus = stripeEvent.type === "charge.dispute.created" ? "disputed" : "refunded";

      const { data: donation, error: findError } = await supabase
        .from("campaign_donations")
        .select("id, status")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();

      if (findError) {
        console.error("[DB Error] Failed to look up donation for refund/dispute:", findError);
        return new Response("Database lookup error", { status: 500 });
      }

      if (donation) {
        const { error: updateDonationError } = await supabase
          .from("campaign_donations")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", donation.id);

        if (updateDonationError) {
          console.error(
            `[DB Error] Failed to mark donation ${donation.id} as ${newStatus}:`,
            updateDonationError,
          );
          return new Response("Failed to update donation status", { status: 500 });
        }

        console.log(`[Webhook Ingestion] Donation ${donation.id} marked as ${newStatus}.`);
      }
    }

    return new Response(JSON.stringify({ status: "success", eventId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Webhook Ingestion Exception]:", errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
