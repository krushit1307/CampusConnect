import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { eventId, ingredients, timestamp } = payload;

    if (!eventId || !ingredients || ingredients.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required payload data." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Generate a cryptographic SHA-256 hash of the payload to ensure immutability
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(payload));
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const txHash = "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // 2. Initialize Supabase Admin Client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 3. Write to an append-only ledger table
    // (Assuming 'supply_chain_ledger' exists. If not, the maintainers will migrate it based on this PR)
    const { error: dbError } = await supabaseClient.from("supply_chain_ledger").insert([
      {
        event_id: eventId,
        transaction_hash: txHash,
        payload: payload,
        logged_at: timestamp,
      },
    ]);

    if (dbError) throw dbError;

    // Return the cryptographic hash back to the React UI
    return new Response(JSON.stringify({ success: true, txHash }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Ledger write error:", error);
    return new Response(JSON.stringify({ error: "Failed to write to ledger." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
