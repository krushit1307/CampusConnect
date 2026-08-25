import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { verifyAuth } from "../shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
    return new Response(JSON.stringify({ error: "Flash-sale service is not configured" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  let pendingSaleId: string | null = null;
  const userSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  try {
    const user = await verifyAuth(req, userSupabase);
    const body = await req.json();
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    const discountPercent = Number(body.discountPercent);
    const durationMinutes = Number(body.durationMinutes);

    if (!eventId || !Number.isFinite(discountPercent) || !Number.isFinite(durationMinutes)) {
      return new Response(
        JSON.stringify({ error: "eventId, discountPercent, and durationMinutes are required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const { data: sale, error: saleError } = await userSupabase.rpc("create_event_flash_sale", {
      p_event_id: eventId,
      p_discount_percent: discountPercent,
      p_duration_minutes: durationMinutes,
    });
    if (saleError || !sale) throw new Error(saleError?.message ?? "Could not prepare flash sale");
    pendingSaleId = sale.id;

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("title")
      .eq("id", eventId)
      .single();
    if (eventError || !event) throw new Error("Event not found");

    const product = await stripe.products.create({
      name: `${event.title} Flash Sale Ticket`,
      metadata: { event_id: eventId, flash_sale_id: sale.id },
    });
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: sale.sale_price_cents,
      product: product.id,
      metadata: { event_id: eventId, flash_sale_id: sale.id },
    });

    const { data: activeSale, error: activateError } = await admin.rpc(
      "activate_event_flash_sale",
      {
        p_sale_id: sale.id,
        p_sale_stripe_price_id: price.id,
      },
    );
    if (activateError || !activeSale) {
      await stripe.prices.update(price.id, { active: false });
      throw new Error(activateError?.message ?? "Could not activate flash sale");
    }

    const { data: notificationCount, error: notificationError } = await admin.rpc(
      "queue_flash_sale_notifications",
      {
        p_sale_id: sale.id,
      },
    );
    if (notificationError)
      console.error("Flash-sale notification fanout failed", notificationError);

    const channel = admin.channel(`event-flash-sale:${eventId}`);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Realtime broadcast timed out")), 5000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(`Realtime channel status: ${status}`));
        }
      });
    });
    await channel.send({
      type: "broadcast",
      event: "flash-sale",
      payload: {
        eventId,
        saleId: activeSale.id,
        discountPercent: activeSale.discount_percent,
        salePriceCents: activeSale.sale_price_cents,
        expiresAt: activeSale.expires_at,
      },
    });
    await channel.unsubscribe();

    return new Response(
      JSON.stringify({
        sale: activeSale,
        notificationCount: notificationError ? 0 : (notificationCount ?? 0),
        startedBy: user.id,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    if (pendingSaleId) {
      await admin
        .from("event_flash_sales")
        .update({ status: "cancelled" })
        .eq("id", pendingSaleId)
        .eq("status", "pending");
    }
    console.error("start-flash-sale failed", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Could not start flash sale",
      }),
      { status: 400, headers: jsonHeaders },
    );
  }
});
