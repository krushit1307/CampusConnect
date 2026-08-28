// =============================================================================
// Edge Function: Create Stripe Checkout Session (with Group Discounts)
// Issue: #2902 - Implement 'Group Discounts' for Event Ticketing
// Description: Creates a Stripe Checkout session. Validates the requested
// quantity against remaining capacity, calculates the group discount, and
// applies it as a negative line item (discount) in the Stripe session.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import {
  AFFILIATE_SOURCE_METADATA_KEY,
  buildAffiliateSourceMetadata,
  calculateMultiCampusRevenueSplit,
  formatAffiliateConnectCharge,
  shouldApplyAffiliateSplit,
} from "../_shared/multiCampusRevenueSplit.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiscountRule {
  min_qty: number;
  discount_pct: number;
}

type AdminClient = ReturnType<typeof createClient>;

async function resolveBuyerCampusInstanceId(
  admin: AdminClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await admin
    .from("profiles")
    .select("college, campus_instance_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.campus_instance_id) return profile.campus_instance_id;

  const college = (profile?.college || "").trim();
  if (!college) return "";

  const { data: campus } = await admin
    .from("campus_instances")
    .select("id")
    .ilike("institution_name", college)
    .limit(1)
    .maybeSingle();

  return campus?.id || "";
}

async function resolveAffiliateCheckout(opts: {
  admin: AdminClient;
  userId: string;
  event: { club_id?: string | null; clubs?: unknown };
  grossCents: number;
}) {
  const clubRow = opts.event.clubs;
  const club = (Array.isArray(clubRow) ? clubRow[0] : clubRow) as {
    id?: string;
    campus_instance_id?: string | null;
    stripe_account_id?: string | null;
  } | null;

  const buyerInstanceId = await resolveBuyerCampusInstanceId(opts.admin, opts.userId);
  const hostInstanceId =
    (club?.campus_instance_id || "").trim() ||
    (Deno.env.get("CAMPUS_INSTANCE_ID") || "").trim();

  if (!shouldApplyAffiliateSplit(buyerInstanceId, hostInstanceId)) {
    return null;
  }

  const split = calculateMultiCampusRevenueSplit(opts.grossCents);
  let affiliateStripeAccount = "";
  const { data: affiliateCampus } = await opts.admin
    .from("campus_instances")
    .select("student_union_stripe_account_id")
    .eq("id", buyerInstanceId)
    .maybeSingle();
  affiliateStripeAccount = affiliateCampus?.student_union_stripe_account_id || "";

  const hostStripeAccountId = club?.stripe_account_id || "";
  const connect = hostStripeAccountId
    ? formatAffiliateConnectCharge(split, hostStripeAccountId)
    : null;

  return {
    buyerInstanceId,
    hostInstanceId,
    hostClubId: club?.id || opts.event.club_id || "",
    affiliateStripeAccount,
    split,
    connect,
    affiliateSourceMetadata: buildAffiliateSourceMetadata(buyerInstanceId),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate User
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Parse Request
    const { eventId, quantity, friendEmails } = await req.json();
    if (!eventId || (!quantity && (!friendEmails || friendEmails.length === 0))) {
      throw new Error("Invalid event ID or quantity");
    }

    // Validate friend emails and retrieve their IDs
    const friendUserIds: string[] = [];
    if (friendEmails && Array.isArray(friendEmails) && friendEmails.length > 0) {
      if (friendEmails.length > 4) {
        throw new Error("You can dynamically add up to 4 additional friend emails.");
      }

      for (const email of friendEmails) {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) continue;

        const { data: rpcData, error: rpcError } = await adminSupabase.rpc("get_user_id_by_email", {
          target_email: trimmed,
        });

        if (rpcError || !rpcData || rpcData.length === 0) {
          throw new Error(`Friend with email "${email}" is not registered on the platform.`);
        }

        const friendId = rpcData[0].user_id;
        if (friendId === user.id) {
          throw new Error("You cannot add your own email as a friend email.");
        }
        if (friendUserIds.includes(friendId)) {
          throw new Error(`Duplicate friend email detected: ${email}`);
        }
        friendUserIds.push(friendId);
      }
    }

    const totalQuantity = friendUserIds.length > 0 ? 1 + friendUserIds.length : quantity || 1;

    // 3. Fetch Active Ticket Tier & Validate Capacity
    const { data: activeTiers, error: tierError } = await supabase.rpc("get_active_ticket_tier", {
      p_event_id: eventId,
    });

    if (tierError || !activeTiers || activeTiers.length === 0) {
      throw new Error("No ticket tier is currently available");
    }

    const tier = activeTiers[0];

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(
        "title, club_id, requires_signature, clubs ( id, campus_instance_id, stripe_account_id )",
      )
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    // Issue #4837: Block checkout until the NDA is signed for gated events.
    if ((event as any).requires_signature) {
      const { data: signature } = await adminSupabase
        .from("event_nda_signatures")
        .select("status")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (signature?.status !== "completed") {
        return new Response(
          JSON.stringify({ error: "You must sign the event NDA before checking out." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
    const remainingCapacity = tier.capacity !== null ? tier.capacity - tier.sold_count : Infinity;

    if (totalQuantity > remainingCapacity) {
      throw new Error(`Only ${remainingCapacity} tickets remaining for the current tier.`);
    }

    const { data: tierPayment } = await adminSupabase
      .from("ticket_tiers")
      .select("stripe_price_id")
      .eq("id", tier.id)
      .maybeSingle();

    const { data: activeFlashSale } = await adminSupabase
      .from("event_flash_sales")
      .select("id, sale_price_cents, sale_stripe_price_id, discount_percent, expires_at")
      .eq("event_id", eventId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Calculate Discount. Flash sales are deliberately not stackable
    // with group discounts so the organizer's advertised price is exact.
    const rules: DiscountRule[] = activeFlashSale ? [] : tier.discount_rules || [];
    const sortedRules = [...rules].sort((a, b) => b.min_qty - a.min_qty);

    let applicableDiscount = 0;
    if (totalQuantity === 5) {
      applicableDiscount = 20; // Buy 4, Get 1 Free represents a 20% discount on 5 tickets
    } else {
      for (const rule of sortedRules) {
        if (totalQuantity >= rule.min_qty) {
          applicableDiscount = rule.discount_pct;
          break;
        }
      }
    }

    // Check if dynamic pricing is active on this event
    const { data: eventDetails, error: eventDetailsError } = await supabase
      .from("events")
      .select("base_price, surge_multiplier")
      .eq("id", eventId)
      .single();

    let basePriceCents = tier.price;
    let isDynamic = false;
    if (!eventDetailsError && eventDetails && eventDetails.base_price !== null) {
      const { data: dynamicPrice, error: priceError } = await supabase.rpc(
        "calculate_current_price",
        {
          p_event_id: eventId,
        },
      );
      if (!priceError && dynamicPrice !== null) {
        basePriceCents = dynamicPrice;
        isDynamic = true;
      }
    }

    if (activeFlashSale) basePriceCents = activeFlashSale.sale_price_cents;

    const subtotal = basePriceCents * totalQuantity;
    const discountAmount = Math.round(subtotal * (applicableDiscount / 100));
    let totalAmount = subtotal - discountAmount;

    // 5. Check User Platform Balance & Auto-Deduct before hitting Credit Card (#4522)
    const { data: userBal } = await adminSupabase
      .from("user_platform_balances")
      .select("balance_cents, lifetime_spent_cents")
      .eq("user_id", user.id)
      .maybeSingle();

    const userBalanceCents = userBal?.balance_cents || 0;
    const creditToApply = Math.min(userBalanceCents, totalAmount);
    const remainingToChargeCents = totalAmount - creditToApply;

    // If user platform credit covers 100% of order, bypass Stripe completely
    if (creditToApply > 0 && remainingToChargeCents === 0) {
      const newBalance = userBalanceCents - creditToApply;
      const newSpent = (userBal?.lifetime_spent_cents || 0) + creditToApply;

      await adminSupabase
        .from("user_platform_balances")
        .update({
          balance_cents: newBalance,
          lifetime_spent_cents: newSpent,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      await adminSupabase.from("user_platform_credit_ledger").insert({
        user_id: user.id,
        amount_cents: -creditToApply,
        balance_after_cents: newBalance,
        transaction_type: "checkout_deduction",
        description: `100% Platform credit checkout for ${totalQuantity}x "${event.title}"`,
        reference_id: eventId,
        bonus_amount_cents: 0,
        metadata: {
          event_id: eventId,
          tier_id: tier.id,
          quantity: totalQuantity,
          total_amount_cents: totalAmount,
        },
      });

      // Create RSVP records for the user and friends
      const allUserIds = [user.id, ...friendUserIds];
      for (const uid of allUserIds) {
        const isPurchaser = uid === user.id;
        const { data: insertedRsvp, error: insertRsvpError } = await adminSupabase
          .from("event_rsvps")
          .insert({
            event_id: eventId,
            user_id: uid,
            status: "PAID",
            ticket_tier_id: tier.id,
            paid_amount_cents: isPurchaser ? creditToApply : 0, // Paid with platform credit
            created_at: new Date().toISOString(),
          })
          .select("id, ticket_id, version")
          .single();

        if (insertRsvpError) {
          console.error(
            `[DB Error] Failed to insert RSVP for user ${uid} (credit):`,
            insertRsvpError,
          );
          continue;
        }

        // Sign ticket
        try {
          if (insertedRsvp?.ticket_id) {
            const { data: profile } = await adminSupabase
              .from("profiles")
              .select("public_key")
              .eq("id", uid)
              .single();

            if (profile?.public_key) {
              const { signTicket } = await import("../_shared/ticket-crypto.ts");
              const signature = await signTicket(
                insertedRsvp.ticket_id,
                eventId,
                profile.public_key,
                insertedRsvp.version || 1,
              );
              await adminSupabase
                .from("event_rsvps")
                .update({
                  owner_public_key: profile.public_key,
                  signature: signature,
                })
                .eq("id", insertedRsvp.id);
            }
          }
        } catch (cryptoErr) {
          console.error("Failed to sign ticket on credit checkout:", cryptoErr);
        }

        // Send email
        const recipientEmail = isPurchaser
          ? user.email || ""
          : friendEmails[friendUserIds.indexOf(uid)] || "";

        if (recipientEmail) {
          const emailBody = {
            from: "CampusConnect <notifications@campusconnect.app>",
            to: [recipientEmail],
            subject: `Your Ticket for ${event.title}! 🎟️`,
            html: `
                            <h2>Ticket Confirmation: ${event.title}</h2>
                            <p>Hi there,</p>
                            <p>You have been registered for <strong>${event.title}</strong>.</p>
                            <p>Here is your digital ticket ID: <strong>${insertedRsvp?.ticket_id}</strong></p>
                            <p>Enjoy the event!</p>
                        `,
          };

          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          const mockEmail = Deno.env.get("MOCK_EMAIL") === "true";

          if (!resendApiKey || mockEmail) {
            console.log(
              `[Email Mock] Ticket sent to ${recipientEmail} with ticket ID: ${insertedRsvp?.ticket_id}`,
            );
          } else {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify(emailBody),
            });
          }
        }
      }

      return new Response(
        JSON.stringify({
          paidWithCredit: true,
          creditAppliedCents: creditToApply,
          remainingAmountCents: 0,
          url: `${req.headers.get("origin")}/events/${eventId}/tickets/success?credit_order=true`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 6. Build Stripe Line Items. A sale Price is resolved only on the
    // server; the browser never supplies an amount or Stripe Price ID.
    const activeStripePriceId =
      activeFlashSale?.sale_stripe_price_id || tierPayment?.stripe_price_id;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      activeStripePriceId && creditToApply === 0
        ? [{ price: activeStripePriceId, quantity: totalQuantity }]
        : [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: activeFlashSale
                    ? `${event.title} (Flash Sale)`
                    : isDynamic
                      ? `${event.title} (Dynamic Price)`
                      : `${event.title} - ${tier.name}`,
                  description: `${totalQuantity} ticket(s)`,
                },
                unit_amount: basePriceCents,
              },
              quantity: totalQuantity,
            },
          ];

    // Apply discount as a negative line item if applicable
    if (discountAmount > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Group Discount (${applicableDiscount}% off)`,
          },
          unit_amount: -discountAmount, // Negative amount for discount
        },
        quantity: 1,
      });
    }

    // Apply partial platform credit deduction as a negative line item
    if (creditToApply > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "CampusConnect Platform Credit",
          },
          unit_amount: -creditToApply,
        },
        quantity: 1,
      });

      // Deduct platform credit
      const newBalance = userBalanceCents - creditToApply;
      const newSpent = (userBal?.lifetime_spent_cents || 0) + creditToApply;

      await adminSupabase
        .from("user_platform_balances")
        .update({
          balance_cents: newBalance,
          lifetime_spent_cents: newSpent,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      await adminSupabase.from("user_platform_credit_ledger").insert({
        user_id: user.id,
        amount_cents: -creditToApply,
        balance_after_cents: newBalance,
        transaction_type: "checkout_deduction",
        description: `Partial platform credit checkout for ${totalQuantity}x "${event.title}"`,
        reference_id: eventId,
        bonus_amount_cents: 0,
        metadata: {
          event_id: eventId,
          tier_id: tier.id,
          quantity: totalQuantity,
          credit_applied_cents: creditToApply,
          remaining_cents: remainingToChargeCents,
        },
      });
    }

    // 7. Create Stripe Checkout Session for remaining balance
    const affiliate = remainingToChargeCents > 0
      ? await resolveAffiliateCheckout({
          admin: adminSupabase,
          userId: user.id,
          event,
          grossCents: remainingToChargeCents,
        })
      : null;

    const paymentIntentData: Record<string, unknown> = {
      setup_future_usage: "off_session",
    };
    if (affiliate) {
      paymentIntentData.metadata = affiliate.affiliateSourceMetadata;
      if (affiliate.connect) {
        paymentIntentData.application_fee_amount = affiliate.connect.applicationFeeAmountCents;
        paymentIntentData.transfer_data = {
          destination: affiliate.connect.destinationAccountId,
        };
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${req.headers.get("origin")}/events/${eventId}/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/events/${eventId}/tickets`,
      metadata: {
        user_id: user.id,
        tier_id: tier.id,
        quantity: totalQuantity.toString(),
        discount_applied: applicableDiscount.toString(),
        credit_applied_cents: creditToApply.toString(),
        flash_sale_id: activeFlashSale?.id || "",
        flash_sale_discount: activeFlashSale?.discount_percent?.toString() || "",
        event_id: eventId,
        group_checkout: (friendUserIds.length > 0).toString(),
        friend_user_ids: friendUserIds.join(","),
        friend_emails: (friendEmails || []).join(","),
        ...(affiliate
          ? {
              [AFFILIATE_SOURCE_METADATA_KEY]: affiliate.buyerInstanceId,
              host_instance_id: affiliate.hostInstanceId,
              host_club_id: affiliate.hostClubId,
              affiliate_stripe_account: affiliate.affiliateStripeAccount,
              gross_cents: affiliate.split.grossCents.toString(),
              host_club_cents: affiliate.split.hostClubCents.toString(),
              affiliate_cents: affiliate.split.affiliateCents.toString(),
              platform_fee_cents: affiliate.split.platformFeeCents.toString(),
            }
          : {}),
      },
      // Enforce "All or Nothing" refund policy for group purchases
      payment_intent_data: paymentIntentData,
    });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
        creditAppliedCents: creditToApply,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[StripeCheckout] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
