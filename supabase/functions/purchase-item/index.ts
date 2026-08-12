// =============================================================================
// Edge Function: Purchase Store Item
// Issue: #2813 - Implement an In - App Wallet for Gamification Points
// Description: Securely proxies the purchase request to the Postgres RPC
// function.Validates the user's JWT and handles the atomic transaction
// to prevent double - spending race conditions.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate the user via JWT
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized: User not authenticated");
    }

    // 2. Parse request body
    const { itemId, quantity } = await req.json();
    if (!itemId || !quantity) {
      throw new Error("Missing required fields: itemId, quantity");
    }

    // 3. Call the atomic RPC function
    // The RPC handles row-level locking, balance checks, and ledger inserts
    const { data, error } = await supabase.rpc("purchase_store_item", {
      p_user_id: user.id,
      p_item_id: itemId,
      p_quantity: quantity,
    });

    if (error) {
      console.error("[PurchaseItem] RPC Error:", error);
      throw error;
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    // Map specific Postgres errors to user-friendly messages
    let status = 400;
    let message = error.message;

    if (message.includes("Insufficient funds")) {
      status = 402; // Payment Required
    } else if (message.includes("Insufficient stock")) {
      status = 409; // Conflict
    } else if (message.includes("Unauthorized")) {
      status = 401;
    }

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
