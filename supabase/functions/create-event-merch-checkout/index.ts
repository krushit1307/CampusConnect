// =============================================================================
// Edge Function: Create Event Merch Checkout Session
// Issue: #3924 — Dynamic Event Merch Store Module
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const {
      eventId,
      userId,
      ticketPriceCents,
      ticketName,
      merchItems,
      successUrl,
      cancelUrl,
    } = body;

    if (user.id !== userId) {
      return new Response(
        JSON.stringify({ error: "User ID mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "Event ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Build Stripe line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Add ticket as first line item (if not free)
    if (ticketPriceCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: ticketPriceCents,
          product_data: {
            name: ticketName || "Event Ticket",
          },
        },
      });
    }

    // 2. Validate and add merch items
    const merchLineItems: Array<{
      variantId: string;
      quantity: number;
      priceCents: number;
    }> = [];

    for (const item of merchItems) {
      const { data: variant, error: variantError } = await supabaseClient
        .from("event_merch_variants")
        .select(
          `
          id, size, stock_quantity, price,
          item:event_merch_items(id, name, price, event_id)
        `,
        )
        .eq("id", item.variantId)
        .single();

      if (variantError || !variant) {
        return new Response(
          JSON.stringify({
            error: `Merch variant ${item.variantId} not found.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (variant.item?.event_id !== eventId) {
        return new Response(
          JSON.stringify({
            error: `Merch variant does not belong to event ${eventId}.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (variant.stock_quantity < item.quantity) {
        return new Response(
          JSON.stringify({
            error: `Insufficient stock for ${variant.item?.name} (${variant.size}). Requested: ${item.quantity}, Available: ${variant.stock_quantity}.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const authoritativePrice = variant.price;

      lineItems.push({
        quantity: item.quantity,
        price_data: {
          currency: "usd",
          unit_amount: authoritativePrice,
          product_data: {
            name: `${variant.item?.name} — Size: ${variant.size}`,
            images: variant.item?.image_url ? [variant.item.image_url] : undefined,
          },
        },
      });

      merchLineItems.push({
        variantId: item.variantId,
        quantity: item.quantity,
        priceCents: authoritativePrice,
      });
    }

    if (lineItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "No items in cart." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        eventId,
        userId,
        merchVariantIds: JSON.stringify(
          merchLineItems.map((m) => ({
            variantId: m.variantId,
            quantity: m.quantity,
          })),
        ),
      },
    });

    // 4. Create a pending order record
    const totalAmount = lineItems.reduce(
      (sum, li) => sum + (li.price_data?.unit_amount || 0) * (li.quantity || 1),
      0,
    );

    const pickupCode = `PICKUP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const { error: orderError } = await supabaseClient
      .from("event_merch_orders")
      .insert({
        event_id: eventId,
        user_id: userId,
        stripe_checkout_session_id: session.id,
        total_amount: totalAmount,
        payment_status: "pending",
        fulfillment_status: "pending",
        pickup_code: pickupCode,
      });

    if (orderError) {
      console.error("Failed to create order record:", orderError);
    }

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
