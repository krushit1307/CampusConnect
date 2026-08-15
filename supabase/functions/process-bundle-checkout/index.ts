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
    const { sessionId } = await req.json();

    if (!sessionId) {
      throw new Error("Missing sessionId");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    if (session.metadata?.type !== "bundle") {
      throw new Error("Not a bundle checkout session");
    }

    const bundleId = session.metadata.bundle_id;
    const userId = session.metadata.user_id;
    const amountPaid = (session.amount_total || 0) / 100;

    // Execute atomic bundle purchase
    const { data, error } = await supabase.rpc("rpc_process_bundle_purchase", {
      p_user_id: userId,
      p_bundle_id: bundleId,
      p_stripe_session_id: sessionId,
      p_amount_paid: amountPaid,
    });

    if (error) {
      console.error("RPC Error processing bundle purchase:", error);
      throw error;
    }

    // MOCK: Send Unified Email Receipt
    console.log(
      `[Email Mock] Sent unified bundle receipt to user ${userId} for bundle ${bundleId}`,
    );

    return new Response(JSON.stringify({ success: true, purchaseId: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error processing bundle checkout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
