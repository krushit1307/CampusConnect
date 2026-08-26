import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key, x-payload-hash",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const limited = await rateLimiter(req, "process-preorder", 10, 60);
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
    const { userId, merchItemId, variantId, quantity } = body;

    // 1. Check if the idempotency key already exists
    const { data: existingRecord } = await supabaseClient
      .from("idempotency_keys")
      .select("status, response_payload, request_hash")
      .eq("key", idempotencyKey)
      .maybeSingle();

    if (existingRecord) {
      if (existingRecord.status === "completed") {
        return new Response(JSON.stringify(existingRecord.response_payload), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Register key
    await supabaseClient.from("idempotency_keys").upsert({
      key: idempotencyKey,
      request_hash: payloadHash,
      status: "processing",
      response_payload: null,
    });

    // 2. Simulate Stripe SetupIntent flow confirming details
    await new Promise((resolve) => setTimeout(resolve, 500));
    const mockPaymentMethodId = `pm_mock_${Math.random().toString(36).substring(2, 12)}`;

    // 3. Insert record into merch_preorders
    const { data: preorder, error: insertError } = await supabaseClient
      .from("merch_preorders")
      .insert({
        user_id: userId,
        merch_item_id: merchItemId,
        variant_id: variantId,
        payment_method_id: mockPaymentMethodId,
        quantity: quantity || 1,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      await supabaseClient.from("idempotency_keys").delete().eq("key", idempotencyKey);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const successPayload = {
      success: true,
      preorderId: preorder.id,
      paymentMethodId: mockPaymentMethodId,
      message: "Pre-order campaign backed successfully!",
    };

    // Update key status to completed
    await supabaseClient
      .from("idempotency_keys")
      .update({
        status: "completed",
        response_payload: successPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("key", idempotencyKey);

    return new Response(JSON.stringify(successPayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
