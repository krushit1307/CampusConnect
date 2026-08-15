import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { bundlePurchaseId } = await req.json();

    if (!bundlePurchaseId) {
      throw new Error("Missing bundlePurchaseId");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get purchase details
    const { data: purchase, error: purchaseError } = await supabase
      .from("bundle_purchases")
      .select("*")
      .eq("id", bundlePurchaseId)
      .single();

    if (purchaseError || !purchase) {
      throw new Error("Purchase not found");
    }

    if (purchase.status !== "completed") {
      throw new Error(`Purchase cannot be refunded. Status is: ${purchase.status}`);
    }

    // Process refund in Stripe
    if (purchase.stripe_session_id && !purchase.stripe_session_id.startsWith("mock_")) {
      const session = await stripe.checkout.sessions.retrieve(purchase.stripe_session_id);
      if (session.payment_intent) {
        await stripe.refunds.create({
          payment_intent: session.payment_intent as string,
        });
      } else {
        console.warn(`No payment intent found for session ${purchase.stripe_session_id}`);
      }
    } else {
      console.log(`[Mock Stripe] Processed refund for ${purchase.stripe_session_id}`);
    }

    // Process atomic refund in Postgres
    const { error: refundError } = await supabase.rpc("rpc_process_bundle_refund", {
      p_bundle_purchase_id: bundlePurchaseId,
    });

    if (refundError) {
      console.error("RPC Error processing bundle refund:", refundError);
      throw refundError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error processing bundle refund:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
