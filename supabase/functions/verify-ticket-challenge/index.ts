import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { parseJsonBody } from "../_shared/validation.ts";
import { verifySignature } from "../_shared/ticket-crypto.ts";

const verifySchema = z.object({
  ticketId: z.string().uuid(),
  challenge: z.string(),
  signature: z.string(),
  kioskId: z.string().optional(),
});

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
    // Note: A real kiosk endpoint might use a specific Kiosk Role or JWT, 
    // but for the MVP, we use the service role since this is an internal Edge Function.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const parsed = await parseJsonBody(verifySchema, req);
    if (!parsed.ok) return parsed.response;
    const { ticketId, challenge, signature } = parsed.data;

    // Optional: Could add challenge expiration checking here if challenge format contains timestamp.
    // E.g., if challenge is "nonce:timestamp", we parse and check it's within 30 seconds.

    // 1. Fetch Ticket
    const { data: ticket } = await supabase
      .from("event_rsvps")
      .select("id, owner_public_key, checked_in")
      .eq("ticket_id", ticketId)
      .single();

    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404, headers: corsHeaders });
    }

    if (ticket.checked_in) {
      return new Response(JSON.stringify({ error: "Ticket has already been used" }), { status: 409, headers: corsHeaders });
    }

    if (!ticket.owner_public_key) {
      return new Response(JSON.stringify({ error: "Invalid ticket: no cryptographic key attached" }), { status: 400, headers: corsHeaders });
    }

    // 2. Verify Signature
    const isValid = await verifySignature(ticket.owner_public_key, signature, challenge);

    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid dynamic QR signature" }), { status: 401, headers: corsHeaders });
    }

    // 3. Mark as checked in
    const { error: updateError } = await supabase
      .from("event_rsvps")
      .update({
        checked_in: true,
      })
      .eq("id", ticket.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
