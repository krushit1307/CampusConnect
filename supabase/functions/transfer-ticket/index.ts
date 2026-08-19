import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { signTicket, verifySignature } from "../_shared/ticket-crypto.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const transferSchema = z.object({
  ticketId: z.string().uuid(),
  receiverUserId: z.string().uuid(),
  timestamp: z.number(),
  nonce: z.string(),
  signature: z.string(),
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = await parseJsonBody(transferSchema, req);
    if (!parsed.ok) return parsed.response;
    const { ticketId, receiverUserId, timestamp, nonce, signature } = parsed.data;

    // 1. Prevent Replay Attacks (Timestamp +/- 5 mins and Nonce uniqueness)
    const now = Date.now();
    if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
      return new Response(JSON.stringify({ error: "Request expired" }), { status: 400, headers: corsHeaders });
    }

    const { error: nonceError } = await supabase
      .from("ticket_nonces")
      .insert({ nonce, ticket_id: ticketId });

    if (nonceError) {
      // Unique violation means replay attack
      return new Response(JSON.stringify({ error: "Duplicate request (nonce used)" }), { status: 400, headers: corsHeaders });
    }

    // 2. Fetch the Ticket and current Owner's Public Key
    const { data: ticket } = await supabase
      .from("event_rsvps")
      .select("id, user_id, event_id, owner_public_key, version")
      .eq("ticket_id", ticketId)
      .single();

    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404, headers: corsHeaders });
    }
    if (ticket.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "You don't own this ticket" }), { status: 403, headers: corsHeaders });
    }
    if (!ticket.owner_public_key) {
      return new Response(JSON.stringify({ error: "Ticket doesn't have a cryptographic key attached" }), { status: 400, headers: corsHeaders });
    }

    // 3. Verify Signature
    const payload = `${ticketId}:${receiverUserId}:${timestamp}:${nonce}`;
    const isValid = await verifySignature(ticket.owner_public_key, signature, payload);

    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid cryptographic signature" }), { status: 401, headers: corsHeaders });
    }

    // 4. Fetch Receiver's Public Key
    const { data: receiverProfile } = await supabase
      .from("profiles")
      .select("public_key")
      .eq("id", receiverUserId)
      .single();

    if (!receiverProfile?.public_key) {
      return new Response(JSON.stringify({ error: "Receiver has not setup decentralized ticketing" }), { status: 400, headers: corsHeaders });
    }

    // 5. Transfer Ticket
    const newVersion = (ticket.version || 1) + 1;
    const newServerSignature = await signTicket(
      ticketId,
      ticket.event_id,
      receiverProfile.public_key,
      newVersion
    );

    const { error: updateError } = await supabase
      .from("event_rsvps")
      .update({
        user_id: receiverUserId,
        owner_public_key: receiverProfile.public_key,
        version: newVersion,
        signature: newServerSignature,
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
    console.error("Transfer error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
