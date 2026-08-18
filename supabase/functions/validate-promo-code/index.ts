// supabase/functions/validate-promo-code/index.ts
// Secure edge validation endpoint for promo codes before checkout creation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_id, code_string, original_price_cents } = await req.json();

    if (!code_string) {
      return new Response(JSON.stringify({ error: "Missing promo code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanCode = code_string.trim().toUpperCase();

    // Query active promo code
    let query = supabase
      .from("promo_codes")
      .select("*")
      .ilike("code_string", cleanCode)
      .eq("is_active", true);

    if (event_id) {
      query = query.or(`event_id.eq.${event_id},event_id.is.null`);
    }

    const { data: promo, error: promoError } = await query.maybeSingle();

    if (promoError || !promo) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid promo code" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "This promo code has expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max usage
    if (promo.current_uses >= promo.max_uses) {
      return new Response(
        JSON.stringify({ valid: false, error: "Promo code usage limit has been reached" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate dynamic discount
    let discountCents = 0;
    const basePrice = original_price_cents || 2000; // default $20

    if (promo.discount_type === "percentage") {
      discountCents = Math.round((basePrice * promo.discount_amount_cents) / 100);
    } else {
      discountCents = promo.discount_amount_cents;
    }

    discountCents = Math.min(discountCents, basePrice);
    const finalPriceCents = Math.max(0, basePrice - discountCents);

    return new Response(
      JSON.stringify({
        valid: true,
        promo_code: promo.code_string,
        discount_type: promo.discount_type,
        discount_amount_cents: discountCents,
        final_price_cents: finalPriceCents,
        is_free: finalPriceCents === 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
