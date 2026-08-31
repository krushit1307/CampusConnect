import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-fingerprint",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SLICE_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifies and burns a fractional ticket slice at the door.
 *
 * A fractional ticket's QR code encodes the slice_token (a UUID). The bouncer
 * scans it and posts it here; the RPC validates that the slice's entry window
 * is currently active and that the token is current (it is regenerated on
 * every ownership transfer), then marks the slice burned exactly once.
 *
 * Accepts: { sliceToken: string, eventId?: string, scannerUserId?: string }
 * Returns: { success, sliceId?, eventId?, ownerUserId?, sliceStart?, sliceEnd?,
 *            burnedAt?, error? }
 */
type SupabaseLike = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

export async function handler(req: Request, supabase?: SupabaseLike): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const client: SupabaseLike =
    supabase ??
    (createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ) as unknown as SupabaseLike);

  let body: { sliceToken?: string; eventId?: string; scannerUserId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { sliceToken, eventId, scannerUserId } = body;
  if (!sliceToken) {
    return new Response(JSON.stringify({ error: "Missing sliceToken" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!SLICE_TOKEN_PATTERN.test(sliceToken)) {
    return new Response(JSON.stringify({ error: "Invalid slice token format" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await client.rpc("burn_ticket_slice", {
    p_slice_token: sliceToken,
    p_scanner_user_id: scannerUserId ?? null,
  });

  if (error) {
    console.error("burn_ticket_slice RPC error:", error);
    return new Response(JSON.stringify({ error: "Failed to verify slice" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = data as {
    success: boolean;
    error?: string;
    slice_id?: string;
    event_id?: string;
    owner_user_id?: string;
    slice_start?: string;
    slice_end?: string;
    burned_at?: string;
  };

  // Optionally confirm the slice belongs to the event the bouncer is scanning for.
  if (result.success && eventId && result.event_id !== eventId) {
    return new Response(JSON.stringify({ error: "Slice does not belong to this event" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 409,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve((req) => handler(req));
