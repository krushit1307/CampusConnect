import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type ExpiredSale = {
  id: string;
  event_id: string;
  sale_stripe_price_id: string | null;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";
  if (!serviceRoleKey || authorization !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !stripeSecretKey) {
    return new Response(JSON.stringify({ error: "Flash-sale expiry service is not configured" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
  const now = new Date().toISOString();
  const { data: expiredSales, error: fetchError } = await admin
    .from("event_flash_sales")
    .select("id, event_id, sale_stripe_price_id")
    .eq("status", "active")
    .lte("expires_at", now)
    .limit(100);
  if (fetchError) {
    console.error("Could not fetch expired flash sales", fetchError);
    return new Response(JSON.stringify({ error: "Could not fetch expired flash sales" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  let expired = 0;
  const failures: string[] = [];
  for (const sale of (expiredSales ?? []) as ExpiredSale[]) {
    try {
      if (sale.sale_stripe_price_id) {
        await stripe.prices.update(sale.sale_stripe_price_id, { active: false });
      }
      const { data: reverted, error: revertError } = await admin.rpc("revert_event_flash_sale", {
        p_sale_id: sale.id,
      });
      if (revertError || !reverted)
        throw new Error(revertError?.message ?? "Sale was already reverted");
      const channel = admin.channel(`event-flash-sale:${sale.event_id}`);
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
        event: "flash-sale-ended",
        payload: { eventId: sale.event_id, saleId: sale.id, expiredAt: now },
      });
      await channel.unsubscribe();
      expired += 1;
    } catch (error) {
      failures.push(sale.id);
      console.error(`Could not expire flash sale ${sale.id}`, error);
    }
  }

  return new Response(JSON.stringify({ expired, failures }), {
    status: failures.length ? 207 : 200,
    headers: jsonHeaders,
  });
});
