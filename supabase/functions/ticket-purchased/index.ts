import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { broadcastTicketPurchased } from "../_shared/ticketPurchasedBroadcast.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      event_id?: string;
      remaining?: number;
      buyer_id?: string | null;
    };
    const eventId = body.event_id;
    if (!eventId) {
      return new Response(JSON.stringify({ error: "event_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let remaining = body.remaining;
    if (remaining == null) {
      const { data: event } = await supabase
        .from("events")
        .select("available_spots, max_attendees")
        .eq("id", eventId)
        .maybeSingle();
      remaining = event?.available_spots ?? event?.max_attendees ?? 0;
    }

    await broadcastTicketPurchased(supabase, eventId, remaining, body.buyer_id);

    return new Response(JSON.stringify({ ok: true, remaining }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "ticket_purchased failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
