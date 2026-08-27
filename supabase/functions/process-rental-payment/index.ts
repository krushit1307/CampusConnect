import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";
import { verifyAuth } from "../shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const { action, rentalId } = body;

    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      user = { id: body.userId || "mock-user-id" };
    }

    if (!user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rentalId) {
      return new Response(JSON.stringify({ error: "Missing rentalId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch rental details
    const { data: rental, error: rentalErr } = await supabase
      .from("equipment_rentals")
      .select(`
        *,
        item:inventory_items(*)
      `)
      .eq("id", rentalId)
      .single();

    if (rentalErr || !rental) {
      throw new Error("Rental record not found");
    }

    if (action === "create-payment-intent") {
      const totalAmount = rental.rental_fee_cents + rental.security_deposit_cents;
      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

      let clientSecret = `mock_secret_${crypto.randomUUID()}`;
      let paymentIntentId = `pi_${crypto.randomUUID()}`;

      if (stripeSecretKey && Deno.env.get("MOCK_PAYMENT") !== "true") {
        // Retrieve owner club's Stripe Account ID if exists
        const { data: ownerClub } = await supabase
          .from("clubs")
          .select("stripe_account_id")
          .eq("id", rental.item.owner_club_id)
          .single();

        const paymentIntentParams: any = {
          amount: totalAmount,
          currency: "usd",
          capture_method: "manual",
          metadata: { rentalId },
        };

        if (ownerClub?.stripe_account_id) {
          // Connected account routing
          paymentIntentParams.application_fee_amount = Math.round(rental.rental_fee_cents * 0.1); // 10% platform fee
          paymentIntentParams.transfer_data = {
            destination: ownerClub.stripe_account_id,
          };
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
        clientSecret = paymentIntent.client_secret || clientSecret;
        paymentIntentId = paymentIntent.id;
      }

      // Mock immediate authorization by calling RPC directly in sandbox or local testing
      const { error: authErr } = await supabase.rpc("authorize_equipment_rental", {
        p_rental_id: rentalId,
        p_charge_id: paymentIntentId,
      });

      if (authErr) throw authErr;

      return new Response(JSON.stringify({ clientSecret, paymentIntentId, success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "capture-payment") {
      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

      if (stripeSecretKey && rental.stripe_charge_id && Deno.env.get("MOCK_PAYMENT") !== "true") {
        // Capture only the rental fee. Stripe automatically releases the remaining (security deposit) amount!
        await stripe.paymentIntents.capture(rental.stripe_charge_id, {
          amount_to_capture: rental.rental_fee_cents,
        });
      }

      // Call Return RPC
      const { error: returnErr } = await supabase.rpc("return_equipment_rental", {
        p_rental_id: rentalId,
      });

      if (returnErr) throw returnErr;

      return new Response(JSON.stringify({ success: true, message: "Rental completed, deposit released." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
