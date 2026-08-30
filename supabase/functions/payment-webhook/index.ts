import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";
import { rateLimiter } from "../shared/rateLimiter.ts";
import { signTicket } from "../_shared/ticket-crypto.ts";
import { AFFILIATE_SOURCE_METADATA_KEY } from "../_shared/multiCampusRevenueSplit.ts";
import { encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import React from "npm:react@18";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "npm:@react-pdf/renderer@3";

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

        // Retrieve club details from campaign_id to check for tax exempt status
        const { data: campaign, error: campaignError } = await supabase
          .from("crowdfunding_campaigns")
          .select("title, club_id")
          .eq("id", campaignId)
          .single();

        if (campaignError || !campaign) {
          console.error(`[Webhook Ingestion] Failed to fetch campaign ${campaignId}:`, campaignError);
        } else {
          const { data: club, error: clubError } = await supabase
            .from("clubs")
            .select("name, is_tax_exempt, tax_id_ein")
            .eq("id", campaign.club_id)
            .single();

          if (clubError || !club) {
            console.error(`[Webhook Ingestion] Failed to fetch club ${campaign.club_id}:`, clubError);
          } else if (club.is_tax_exempt) {
            const donorEmail = session.customer_details?.email || 
              (session.metadata?.donor_id 
                ? (await supabase.from("profiles").select("email").eq("id", session.metadata.donor_id).maybeSingle()).data?.email 
                : null);

            const receiptPromise = generateAndSendTaxReceipt({
              supabase,
              donationId: donation.id,
              donorEmail,
              donorName: session.customer_details?.name || session.metadata?.display_name || "Generous Donor",
              amountCents,
              clubName: club.name,
              ein: club.tax_id_ein,
              clubId: campaign.club_id,
            });

            if (typeof EdgeRuntime !== "undefined") {
              EdgeRuntime.waitUntil(receiptPromise);
            } else {
              await receiptPromise;
            }
          }
        }

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
          .update({
            status: "PAID",
            paid_amount_cents: session.amount_total ?? 0,
            payment_intent_id:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          })
          .eq("id", rsvpId);

        if (updateRsvpError) {
          console.error(`[DB Error] Failed to update RSVP ${rsvpId} to PAID:`, updateRsvpError);
          return new Response("Failed to update RSVP status", { status: 500 });
        }
        console.log(`[Webhook Ingestion] Successfully set RSVP ${rsvpId} status to PAID with payment info.`);

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
        const { data: eventDetails } = await supabase
          .from("events")
          .select("title")
          .eq("id", session.metadata.event_id)
          .single();
        const eventTitle = eventDetails?.title || "Upcoming Event";

        const isGroupCheckout = session.metadata?.group_checkout === "true";
        const allUserIds = [session.metadata.user_id];
        const friendEmails = session.metadata?.friend_emails
          ? session.metadata.friend_emails.split(",")
          : [];
        if (isGroupCheckout && session.metadata?.friend_user_ids) {
          allUserIds.push(...session.metadata.friend_user_ids.split(","));
        }

        for (const uid of allUserIds) {
          const isPurchaser = uid === session.metadata.user_id;
          const { data: rsvp, error: insertRsvpError } = await supabase
            .from("event_rsvps")
            .insert({
              event_id: session.metadata.event_id,
              user_id: uid,
              status: "PAID",
              ticket_tier_id: session.metadata.tier_id,
              paid_amount_cents: isPurchaser ? (session.amount_total ?? 0) : 0,
              payment_intent_id:
                typeof session.payment_intent === "string" ? session.payment_intent : null,
            })
            .select("id, ticket_id, version")
            .single();

          if (insertRsvpError) {
            console.error(`[DB Error] Failed to insert RSVP for user ${uid}:`, insertRsvpError);
            continue;
          }

          // Decentralized Ticketing: Sign the new ticket
          try {
            if (rsvp?.ticket_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("public_key")
                .eq("id", uid)
                .single();

              if (profile?.public_key) {
                const signature = await signTicket(
                  rsvp.ticket_id,
                  session.metadata.event_id,
                  profile.public_key,
                  rsvp.version || 1,
                );

                await supabase
                  .from("event_rsvps")
                  .update({
                    owner_public_key: profile.public_key,
                    signature: signature,
                  })
                  .eq("id", rsvp.id);
              }
            }
          } catch (cryptoErr) {
            console.error(`Failed to sign ticket for user ${uid}:`, cryptoErr);
          }

          // Transactional email notification for ticket distribution
          const recipientEmail = isPurchaser
            ? session.customer_details?.email || ""
            : friendEmails[allUserIds.indexOf(uid) - 1] || "";

          if (recipientEmail) {
            const emailBody = {
              from: "CampusConnect <notifications@campusconnect.app>",
              to: [recipientEmail],
              subject: `Your Ticket for ${eventTitle}! 🎟️`,
              html: `
                <h2>Ticket Confirmation: ${eventTitle}</h2>
                <p>Hi there,</p>
                <p>You have been registered for <strong>${eventTitle}</strong>.</p>
                <p>Here is your digital ticket ID: <strong>${rsvp?.ticket_id}</strong></p>
                <p>Show this ticket ID or your user profile QR code at the door for entry.</p>
                <p>Enjoy the event!</p>
              `,
            };

            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            const mockEmail = Deno.env.get("MOCK_EMAIL") === "true";

            if (!resendApiKey || mockEmail) {
              console.log(
                `[Email Mock] Ticket sent to ${recipientEmail} with ticket ID: ${rsvp?.ticket_id}`,
              );
            } else {
              const emailRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${resendApiKey}`,
                },
                body: JSON.stringify(emailBody),
              });
              if (!emailRes.ok) {
                console.error("Failed to send ticket email via Resend:", await emailRes.text());
              }
            }
          }
        }
      } else {
        console.warn("[Webhook Ingestion] Missing rsvp_id or tier_id metadata parameter.");
        return new Response("Missing rsvp_id or tier_id metadata parameter", { status: 400 });
      }

      // 5c. Dynamic Club Revenue Profit-Sharing (Issue #4415)
      let ticketEventId = session.metadata?.event_id;
      if (!ticketEventId && rsvpId) {
        const { data: rsvpEvt } = await supabase
          .from("event_rsvps")
          .select("event_id")
          .eq("id", rsvpId)
          .single();
        ticketEventId = rsvpEvt?.event_id;
      }

      if (ticketEventId) {
        try {
          const { data: coSponsors } = await supabase
            .from("co_sponsors")
            .select("club_id, revenue_split")
            .eq("event_id", ticketEventId)
            .eq("status", "approved")
            .not("revenue_split", "is", null);

          if (coSponsors && coSponsors.length > 0) {
            const splitConfig = coSponsors[0].revenue_split;

            if (splitConfig && Object.keys(splitConfig).length > 0) {
              console.log(
                `[Webhook Ingestion] Processing Revenue Split for event ${ticketEventId}`,
              );

              let netAmountCents = session.amount_total ?? 0;
              if (session.payment_intent) {
                try {
                  const paymentIntent = await stripe.paymentIntents.retrieve(
                    session.payment_intent as string,
                    {
                      expand: ["latest_charge.balance_transaction"],
                    },
                  );
                  const charge = paymentIntent.latest_charge as any;
                  if (charge && charge.balance_transaction) {
                    netAmountCents = charge.balance_transaction.net;
                  }
                } catch (e) {
                  console.error("Failed to retrieve balance_transaction:", e);
                }
              }

              const transfers = [];
              for (const [clubId, percentage] of Object.entries(splitConfig)) {
                if (typeof percentage === "number" && percentage > 0) {
                  transfers.push({
                    club_id: clubId,
                    amount_cents: Math.floor(netAmountCents * (percentage / 100)),
                    pct: percentage,
                    stripe_account_id: null,
                    transfer_id: `sys_split_${Date.now()}_${clubId}`,
                  });
                }
              }

              if (transfers.length > 0) {
                const { error: splitError } = await supabase.rpc("process_cohost_revenue_split", {
                  p_event_id: ticketEventId,
                  p_charge_id:
                    typeof session.payment_intent === "string"
                      ? session.payment_intent
                      : session.id,
                  p_total_amount_cents: netAmountCents,
                  p_transfers: transfers,
                });

                if (splitError) {
                  console.error(`[DB Error] Failed to process revenue split:`, splitError);
                } else {
                  console.log(`[Webhook Ingestion] Successfully executed revenue split.`);
                }
              }
            }
          }
        } catch (splitErr) {
          console.error(`[Webhook Ingestion] Error processing revenue split:`, splitErr);
        }
      }

      // 5d. Multi-campus affiliate revenue split (Issue #4726)
      const affiliateSource = session.metadata?.[AFFILIATE_SOURCE_METADATA_KEY];
      const affiliateCents = Number.parseInt(session.metadata?.affiliate_cents || "0", 10);
      if (affiliateSource && affiliateCents > 0) {
        try {
          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id || session.id;
          const affiliateAccount = session.metadata?.affiliate_stripe_account || "";
          let affiliateTransferId: string | null = null;

          if (affiliateAccount) {
            try {
              const transfer = await stripe.transfers.create(
                {
                  amount: affiliateCents,
                  currency: session.currency || "usd",
                  destination: affiliateAccount,
                  metadata: {
                    [AFFILIATE_SOURCE_METADATA_KEY]: affiliateSource,
                    event_id: session.metadata?.event_id || "",
                    host_instance_id: session.metadata?.host_instance_id || "",
                  },
                },
                { idempotencyKey: `mc-aff-${paymentIntentId}` },
              );
              affiliateTransferId = transfer.id;
            } catch (transferErr) {
              console.error("[Webhook Ingestion] Affiliate Stripe Transfer failed:", transferErr);
            }
          }

          const { error: affiliateLedgerError } = await supabase
            .from("multi_campus_revenue_splits")
            .insert({
              payment_intent_id: paymentIntentId,
              event_id: session.metadata?.event_id || ticketEventId || null,
              host_instance_id: session.metadata?.host_instance_id || "",
              affiliate_instance_id: affiliateSource,
              host_club_id: session.metadata?.host_club_id || null,
              gross_cents: Number.parseInt(session.metadata?.gross_cents || "0", 10),
              host_club_cents: Number.parseInt(session.metadata?.host_club_cents || "0", 10),
              affiliate_cents: affiliateCents,
              platform_fee_cents: Number.parseInt(session.metadata?.platform_fee_cents || "0", 10),
              affiliate_transfer_id: affiliateTransferId,
            });

          if (affiliateLedgerError && affiliateLedgerError.code !== "23505") {
            console.error("[Webhook Ingestion] Failed to record multi-campus split:", affiliateLedgerError);
          }
        } catch (affiliateErr) {
          console.error("[Webhook Ingestion] Error processing multi-campus affiliate split:", affiliateErr);
        }
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

      // ======================================================================
      // 7. Dynamic "Club Revenue" Profit-Sharing (Issue #4415)
      // ======================================================================
      // This module automatically splits ticket revenue between co-hosting
      // clubs immediately at the point of sale, bypassing manual accounting.
      //
      // Algorithm:
      // 1. Identify if the purchased event has a valid Co-Sponsorship contract
      //    defined via a signed `revenue_splits` JSON array.
      // 2. Calculate the exact Stripe Processing Fee (approx 2.9% + $0.30).
      // 3. Subtract the fee from the gross revenue to determine the Net Profit.
      // 4. Distribute the Net Profit proportionally based on the agreed percentages.
      // 5. Handle any fractional cent remainders (e.g., $10 split 3 ways) by
      //    allocating the remainder to the primary host.
      // 6. Execute atomic ledger CREDIT transactions via the RPC function.
      // 7. Generate an immutable Split Receipt for the club Treasurers.
      // ======================================================================

      if (session.metadata?.event_id) {
        try {
          const eventId = session.metadata.event_id;

          // Define strict interfaces for type safety and robust error handling
          interface RevenueSplitConfig {
            club_id: string;
            pct: number;
            stripe_account_id?: string;
          }

          interface TransferLog {
            club_id: string;
            amount_cents: number;
            pct: number;
            stripe_account_id: string;
            transfer_id: string;
          }

          console.log(`[Profit-Sharing Engine] Initializing for Event ID: ${eventId}`);
          console.log(`[Profit-Sharing Engine] Associated Stripe Session: ${session.id}`);

          // Fetch the event's configured revenue splits
          const { data: eventData, error: eventFetchError } = await supabase
            .from("events")
            .select("revenue_splits")
            .eq("id", eventId)
            .single();

          if (eventFetchError) {
            console.error(
              `[Profit-Sharing Engine] Database Error fetching event ${eventId}:`,
              eventFetchError.message,
            );
            throw new Error(`Failed to fetch event data: ${eventFetchError.message}`);
          }

          // Validate that the co-sponsorship contract exists and is populated
          if (
            eventData?.revenue_splits &&
            Array.isArray(eventData.revenue_splits) &&
            eventData.revenue_splits.length > 0
          ) {
            console.log(
              `[Profit-Sharing Engine] Found ${eventData.revenue_splits.length} co-sponsoring clubs. Calculating splits...`,
            );

            // ----------------------------------------------------------------
            // Step 1: Financial Math - Gross, Fees, and Net
            // ----------------------------------------------------------------
            const grossCents = session.amount_total ?? 0;

            // Note: In production with precise Connect routing, you might query
            // the exact Balance Transaction. Here we use the standard domestic
            // card processing fee formula (2.9% + 30 cents).
            const stripeFeeRate = 0.029;
            const stripeFixedFeeCents = 30;

            // Calculate exact fee and round to nearest whole cent
            const stripeFeeCents = Math.round(grossCents * stripeFeeRate + stripeFixedFeeCents);

            // The actual distributable pool of money
            const netProfitCents = Math.max(0, grossCents - stripeFeeCents);

            console.log(
              `[Profit-Sharing Engine] Financials calculated -> Gross: ${grossCents}¢ | Fee: ${stripeFeeCents}¢ | Net: ${netProfitCents}¢`,
            );

            if (netProfitCents > 0) {
              // ----------------------------------------------------------------
              // Step 2: Proportional Allocation & Remainder Management
              // ----------------------------------------------------------------
              let remainingCents = netProfitCents;
              const transfers: TransferLog[] = [];
              const rawSplits = eventData.revenue_splits as RevenueSplitConfig[];

              // We iterate through all splits except the last one to calculate
              // exact math. The last split will sweep any fractional remainders.
              for (let i = 0; i < rawSplits.length; i++) {
                const split = rawSplits[i];
                const isLast = i === rawSplits.length - 1;

                let allocatedCents = 0;

                if (isLast) {
                  // The final club absorbs the remaining pennies to ensure the
                  // total distributed exactly matches the net profit.
                  allocatedCents = remainingCents;
                } else {
                  // Standard proportional allocation rounded to the nearest cent
                  allocatedCents = Math.round(netProfitCents * (split.pct / 100.0));
                  remainingCents -= allocatedCents;
                }

                if (allocatedCents > 0) {
                  transfers.push({
                    club_id: split.club_id,
                    amount_cents: allocatedCents,
                    pct: split.pct,
                    stripe_account_id: split.stripe_account_id || "acct_unlinked",
                    transfer_id: (session.payment_intent as string) || session.id,
                  });
                }
              }

              console.log(
                `[Profit-Sharing Engine] Transfer allocation complete. Dispatching to RPC...`,
              );

              // ----------------------------------------------------------------
              // Step 3: Atomic Database Execution
              // ----------------------------------------------------------------
              // We dispatch the allocations to the centralized RPC to ensure
              // that all ledger balances are updated atomically within a single
              // transaction. This prevents partial updates if the server crashes.
              const { data: splitResult, error: splitError } = await supabase.rpc(
                "process_cohost_revenue_split",
                {
                  p_event_id: eventId,
                  p_charge_id: (session.payment_intent as string) || session.id,
                  p_total_amount_cents: netProfitCents,
                  p_transfers: transfers,
                },
              );

              if (splitError) {
                console.error(
                  `[Profit-Sharing Engine] CRITICAL: RPC Execution Failed for Event ${eventId}`,
                  splitError,
                );
                // We do not throw here to prevent blocking the rest of the webhook
                // processing (e.g. ticket issuance), but we flag it aggressively.
              } else {
                console.log(
                  `[Profit-Sharing Engine] Ledger transactions successful. Generating Split Receipt...`,
                );

                // ----------------------------------------------------------------
                // Step 4: Generate Immutable Split Receipt
                // ----------------------------------------------------------------
                // Insert a permanent record into the receipts table so that
                // Treasurers can transparently audit the fee deductions and math.
                const { error: receiptError } = await supabase
                  .from("revenue_split_receipts")
                  .insert({
                    event_id: eventId,
                    stripe_session_id: session.id,
                    gross_revenue_cents: grossCents,
                    stripe_fee_cents: stripeFeeCents,
                    net_profit_cents: netProfitCents,
                    split_details: transfers,
                  });

                if (receiptError) {
                  console.error(
                    `[Profit-Sharing Engine] Failed to generate Split Receipt:`,
                    receiptError,
                  );
                } else {
                  console.log(
                    `[Profit-Sharing Engine] Workflow complete. Transparency receipt issued.`,
                  );
                }
              }
            } else {
              console.warn(
                `[Profit-Sharing Engine] Net profit is zero or negative. Skipping allocations.`,
              );
            }
          } else {
            console.log(
              `[Profit-Sharing Engine] Event ${eventId} has no co-sponsorship contracts. Proceeding normally.`,
            );
          }
        } catch (err: any) {
          console.error(`[Profit-Sharing Engine] Unhandled Exception:`, err.message, err.stack);
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

const styles = StyleSheet.create({
  page: { padding: 50, fontFamily: "Helvetica", fontSize: 11, color: "#1a1a1a" },
  header: { borderBottomWidth: 2, borderBottomColor: "#4f46e5", paddingBottom: 10, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", color: "#4f46e5", textTransform: "uppercase" },
  section: { marginBottom: 15 },
  label: { fontWeight: "bold", fontSize: 10, color: "#666", textTransform: "uppercase" },
  value: { fontSize: 13, marginBottom: 5 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginVertical: 15 },
  legalText: { fontSize: 10, color: "#4b5563", fontStyle: "italic", marginTop: 20 },
  thankYou: { fontSize: 14, fontWeight: "bold", color: "#111827", marginTop: 15 }
});

const ReceiptDocument = ({ date, amount, donorName, clubName, ein }: any) => {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, "Donation Receipt")
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.label }, "Date of Donation"),
        React.createElement(Text, { style: styles.value }, date)
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.label }, "Donor Name"),
        React.createElement(Text, { style: styles.value }, donorName)
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.label }, "Receiving Organization"),
        React.createElement(Text, { style: styles.value }, clubName),
        ein ? React.createElement(Text, { style: styles.value }, `EIN: ${ein}`) : null
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.label }, "Contribution Amount"),
        React.createElement(Text, { style: styles.value }, `$${(amount / 100).toFixed(2)}`)
      ),
      React.createElement(View, { style: styles.divider }),
      React.createElement(
        Text,
        { style: styles.thankYou },
        "Thank you for your generous support!"
      ),
      React.createElement(
        Text,
        { style: styles.legalText },
        "No goods or services were provided in exchange for this contribution. Your contribution is tax-deductible to the extent allowed by law. Please retain this receipt for your IRS records."
      )
    )
  );
};

async function generateAndSendTaxReceipt({
  supabase,
  donationId,
  donorEmail,
  donorName,
  amountCents,
  clubName,
  ein,
  clubId,
}: {
  supabase: any;
  donationId: string;
  donorEmail: string | null;
  donorName: string;
  amountCents: number;
  clubName: string;
  ein: string | null;
  clubId: string;
}) {
  try {
    console.log(`[Receipt Generation] Creating tax receipt for donation ${donationId}...`);
    
    // 1. Generate PDF using @react-pdf/renderer
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const element = React.createElement(ReceiptDocument, {
      date: dateStr,
      amount: amountCents,
      donorName,
      clubName,
      ein,
    });

    const pdfBuffer = await renderToBuffer(element);
    console.log(`[Receipt Generation] PDF generated successfully. Size: ${pdfBuffer.length} bytes`);

    // 2. Upload to Supabase Storage in 'club_vaults' bucket
    const fileName = `tax_receipt_${donationId}.pdf`;
    const filePath = `${clubId}/Financials/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("club_vaults")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload receipt to storage: ${uploadError.message}`);
    }
    console.log(`[Receipt Generation] PDF uploaded to storage at: ${filePath}`);

    // 3. Find executive/uploader to register upload in vault_documents
    const { data: member } = await supabase
      .from("club_members")
      .select("user_id")
      .eq("club_id", clubId)
      .order("role", { ascending: false }) // president/treasurer first
      .limit(1)
      .maybeSingle();

    const uploaderId = member?.user_id || "00000000-0000-0000-0000-000000000000";

    const { error: dbError } = await supabase
      .from("vault_documents")
      .insert({
        club_id: clubId,
        file_name: fileName,
        file_path: filePath,
        file_size: pdfBuffer.length,
        mime_type: "application/pdf",
        category: "Financials",
        uploaded_by: uploaderId,
      });

    if (dbError) {
      throw new Error(`Failed to record receipt in vault_documents: ${dbError.message}`);
    }

    // Write audit log entry
    await supabase.from("vault_audit_log").insert({
      club_id: clubId,
      user_id: uploaderId,
      action: "UPLOAD",
      file_name: fileName,
    });
    console.log(`[Receipt Generation] Receipt recorded in vault_documents`);

    // 4. Email the receipt to the donor
    if (donorEmail) {
      const emailProvider = Deno.env.get("EMAIL_PROVIDER") || "sendgrid";
      const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const base64Content = encode(pdfBuffer);

      const subject = `Donation Receipt - ${clubName}`;
      const htmlBody = `
        <p>Dear ${donorName},</p>
        <p>Thank you so much for your donation of $${(amountCents / 100).toFixed(2)} to <strong>${clubName}</strong>.</p>
        <p>Your official tax-exempt donation receipt is attached to this email.</p>
        <p>Best regards,<br/>${clubName} Team</p>
      `;

      if (emailProvider === "resend" && resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "CampusConnect <welcome@campusconnect.app>",
            to: [donorEmail],
            subject: subject,
            html: htmlBody,
            attachments: [
              {
                filename: fileName,
                content: base64Content,
              },
            ],
          }),
        });

        if (!res.ok) {
          const resData = await res.text();
          console.error(`[Receipt Generation] Resend API Error:`, resData);
        } else {
          console.log(`[Receipt Generation] Receipt emailed via Resend to ${donorEmail}`);
        }
      } else if (emailProvider === "sendgrid" && sendgridApiKey) {
        const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sendgridApiKey}`,
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: donorEmail, name: donorName }],
              },
            ],
            from: { email: "welcome@campusconnect.app", name: "CampusConnect" },
            subject: subject,
            content: [{ type: "text/html", value: htmlBody }],
            attachments: [
              {
                content: base64Content,
                type: "application/pdf",
                filename: fileName,
                disposition: "attachment",
              },
            ],
          }),
        });

        if (!res.ok) {
          const resData = await res.text();
          console.error(`[Receipt Generation] SendGrid API Error:`, resData);
        } else {
          console.log(`[Receipt Generation] Receipt emailed via SendGrid to ${donorEmail}`);
        }
      } else {
        console.log(`[Receipt Generation] [Mock Mode] Would send tax receipt to ${donorEmail} with attached PDF`);
      }
    }
  } catch (error: any) {
    console.error(`[Receipt Generation] Error generating or sending tax receipt for donation ${donationId}:`, error);
  }
}
