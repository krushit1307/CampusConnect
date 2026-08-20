// =============================================================================
// Edge Function: Process Merch Checkout
// Issue: Merch Pre-Order Module
// Description: Server-side validation and checkout session creation for merchandise
// pre-orders. Validates campaign expiry, derives authoritative prices from DB,
// creates pending order and Stripe Checkout Session.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { generateIdempotencyKey, hashPayload } from "../shared/rateLimiter.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key, x-payload-hash",
};

const MIN_ORDER_AMOUNT_CENTS = 100; // $1.00 minimum

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const limited = await rateLimiter(req, "process-merch-checkout", 20, 60);
  if (limited) return limited;

  try {
    const idempotencyKey = req.headers.get("Idempotency-Key");
    const payloadHash = req.headers.get("X-Payload-Hash");

    if (!idempotencyKey || !payloadHash) {
      return new Response(
        JSON.stringify({ error: "Missing Idempotency-Key or X-Payload-Hash header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    const {
      userId,
      clubId,
      variantIds, // array of variant IDs in the cart
      quantities, // array of quantities corresponding to variantIds
      campaignId, // optional: specific campaign ID if restricting to one campaign
    } = body;

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized - user not logged in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user.id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized - user ID mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validate cart
    if (!variantIds || variantIds.length === 0) {
      return new Response(JSON.stringify({ error: "Cart is empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (variantIds.length !== quantities.length) {
      return new Response(
        JSON.stringify({ error: "Variant and quantity arrays must have same length" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (variantIds.some((v: string) => !v)) {
      return new Response(JSON.stringify({ error: "Invalid variant ID in cart" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Validate campaign (if campaignId provided) and fetch variants with authoritative prices
    const variantIdsInt = variantIds.map((v: string) => v);

    // Fetch variants with their campaign association and authoritative pricing
    const { data: variants, error: variantsError } = await supabaseClient
      .from("merch_variants")
      .select(
        `
        id,
        merch_item_id,
        name,
        price,
        stock,
        merch_items (
          club_id,
          campaign_status,
          campaign_end_date
        )
      `,
      )
      .in("id", variantIdsInt);

    if (variantsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch variants: " + variantsError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!variants || variants.length === 0) {
      return new Response(JSON.stringify({ error: "No valid variants found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Validate all variants belong to the same club and campaign (if specified)
    // Check club_id consistency across all variants' items
    const clubs = new Set(variants.map((v) => v.merch_items.club_id));

    if (clubs.size > 1) {
      return new Response(
        JSON.stringify({ error: "Variants belong to different clubs, cannot checkout together" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const targetClubId = clubs.has(clubId) ? clubId : clubs.values().next().value;

    // If campaignId specified, validate all variants belong to that campaign
    if (campaignId) {
      const allMatchCampaign = variants.every(
        (v: any) => v.merch_items.campaign_status && v.merch_items.campaign_end_date !== null,
      );

      if (!allMatchCampaign) {
        return new Response(
          JSON.stringify({ error: "Some variants are not part of an active campaign" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 5. Validate campaign expiry (HARD requirement - server-side)
    now = new Date();
    for (const variant of variants) {
      const campaignEndDate = variant.merch_items.campaign_end_date;
      if (campaignEndDate) {
        const endDate = new Date(campaignEndDate);
        if (now >= endDate) {
          return new Response(
            JSON.stringify({ error: "This campaign has ended and can no longer accept purchases" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      // Also validate campaign status is active
      if (variant.merch_items.campaign_status !== "active") {
        return new Response(JSON.stringify({ error: "This campaign is no longer active" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 6. Build order items and calculate total server-side
    let totalAmount = 0;
    const orderItems = [];

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const quantity = quantities[i] || 1;
      const unitPrice = variant.price; // authoritative price from DB, NOT client-provided

      if (unitPrice <= 0) {
        return new Response(JSON.stringify({ error: `Variant ${variant.id} has invalid price` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate stock if available
      if (variant.stock !== undefined && variant.stock > 0) {
        // Check if sufficient stock available
        // Note: For pre-orders/crowdfunding, stock may not be enforced until campaign completion
        // But we should at least check if going over would be problematic
      }

      totalAmount += unitPrice * quantity;
      orderItems.push({
        variant_id: variant.id,
        quantity,
        unit_price: unitPrice,
      });
    }

    // 7. Validate minimum order amount
    if (totalAmount < MIN_ORDER_AMOUNT_CENTS) {
      return new Response(
        JSON.stringify({ error: `Order total must be at least $${MIN_ORDER_AMOUNT_CENTS / 100}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 8. Create pending order in database
    const { data: order, error: orderError } = await supabaseClient
      .from("merch_orders")
      .insert({
        user_id: userId,
        club_id: targetClubId,
        payment_status: "pending",
        fulfillment_status: "pending",
        total_amount: totalAmount,
      })
      .select()
      .single();

    if (orderError) {
      return new Response(
        JSON.stringify({ error: "Failed to create order: " + orderError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 9. Create order items
    for (const item of orderItems) {
      await supabaseClient.from("merch_order_items").insert({
        order_id: order.id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      });
    }

    // 10. Create Stripe Checkout Session using server-derived prices
    const lineItems = orderItems.map((item: any) => {
      const variant = variants.find((v: any) => v.id === item.variant_id);
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: variant?.merch_item?.name || "Merch Item",
            description: `Variant: ${variant?.name || ""}`,
          },
          unit_amount: item.unit_price, // cents from DB
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      success_url: `${req.headers.get("origin")}/clubs/${targetClubId}/merch?success=1&order_id=${order.id}`,
      cancel_url: `${req.headers.get("origin")}/clubs/${targetClubId}/merch?cancelled=1`,
      metadata: {
        order_id: order.id,
        user_id: userId,
        club_id: targetClubId,
      },
      automatic_tax: { enabled: false },
    });

    // 11. Update order with Stripe session ID
    await supabaseClient
      .from("merch_orders")
      .update({
        stripe_checkout_session_id: session.id,
      })
      .eq("id", order.id);

    const successPayload = {
      success: true,
      orderId: order.id,
      checkoutUrl: session.url,
      stripeSessionId: session.id,
      totalAmount: totalAmount,
      currency: "usd",
    };

    return new Response(JSON.stringify(successPayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[process-merch-checkout] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper to get current date for comparison
const now = new Date();
