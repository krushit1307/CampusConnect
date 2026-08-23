// =============================================================================
// File: supabase/functions/stripe-flash-sale-mutator/index.ts
// Issue: #4292 - Build a 'Real-Time "Dynamic Pricing" Flash Sale Engine'
// Description: Supabase Edge Function to dynamically mutate Stripe Price IDs,
//              broadcast marketing webhooks, and schedule automated price rollbacks.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FlashSaleMutationPayload {
  campaignId: string;
  eventId: string;
  ticketTierId: string;
  originalPriceUsd: number;
  discountPercentage: number;
  durationMinutes: number;
  ticketCap: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: FlashSaleMutationPayload = await req.json();
    const discountedPrice = Number(
      (body.originalPriceUsd * (1 - body.discountPercentage / 100)).toFixed(2)
    );

    // Call RPC to activate campaign
    const { data, error } = await supabaseClient.rpc("trigger_flash_sale_rpc", {
      p_campaign_id: body.campaignId,
      p_event_id: body.eventId,
      p_ticket_tier_id: body.ticketTierId,
      p_original_price: body.originalPriceUsd,
      p_discount_percentage: body.discountPercentage,
      p_duration_minutes: body.durationMinutes,
      p_ticket_cap: body.ticketCap,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaignId: body.campaignId,
        discountedPriceUsd: discountedPrice,
        data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
