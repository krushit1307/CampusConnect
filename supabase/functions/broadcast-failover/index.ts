import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-broadcast-signature",
};

type FailoverRequest = {
  eventId: string;
  connectionState: "connected" | "disconnected" | "failed" | "checking";
  avCheckPassed?: boolean;
  failureReason?: string;
  metadata?: Record<string, unknown>;
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function constantTimeEquals(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let result = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    result |= leftBytes[index] ^ rightBytes[index];
  }
  return result === 0;
}

async function switchProviderSource(session: Record<string, unknown>) {
  const switchUrl = Deno.env.get("BROADCAST_SWITCH_URL");
  const switchToken = Deno.env.get("BROADCAST_SWITCH_TOKEN");
  if (!switchUrl || !switchToken) return { status: "not_configured", error: null };

  const response = await fetch(switchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${switchToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId: session.event_id,
      source: session.active_source,
      primaryStreamUrl: session.primary_stream_url,
      fallbackSlateUrl: session.fallback_slate_url,
      loopFallback: true,
    }),
  });
  if (!response.ok)
    return { status: "failed", error: `Stream provider returned HTTP ${response.status}.` };
  return { status: "succeeded", error: null };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey)
      return jsonResponse({ error: "Server is not configured" }, 500);
    const serviceClient = createClient(supabaseUrl, serviceKey);
    const body = (await req.json()) as FailoverRequest;
    if (!body.eventId || !body.connectionState)
      return jsonResponse({ error: "eventId and connectionState are required" }, 400);

    const configuredSecret = Deno.env.get("BROADCAST_WEBHOOK_SECRET");
    const signature = req.headers.get("x-broadcast-signature");
    const isMediaServerSignal = Boolean(
      configuredSecret && signature && (await constantTimeEquals(signature, configuredSecret)),
    );

    let session: Record<string, unknown> | null = null;
    if (isMediaServerSignal) {
      const { data, error } = await serviceClient.rpc("apply_broadcast_media_signal", {
        p_event_id: body.eventId,
        p_connection_state: body.connectionState,
        p_av_check_passed: body.avCheckPassed ?? false,
        p_failure_reason: body.failureReason ?? null,
        p_metadata: body.metadata ?? {},
      });
      if (error) return jsonResponse({ error: error.message }, 500);
      session = data as Record<string, unknown>;
    } else {
      const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!token) return jsonResponse({ error: "Authentication required" }, 401);
      const { data: authData, error: authError } = await serviceClient.auth.getUser(token);
      if (authError || !authData.user)
        return jsonResponse({ error: "Authentication required" }, 401);
      const { data: sessionRows, error: sessionError } = await serviceClient
        .from("event_broadcast_sessions")
        .select("id")
        .eq("event_id", body.eventId)
        .limit(1);
      if (sessionError || !sessionRows?.[0])
        return jsonResponse({ error: "Broadcast session not found" }, 404);
      const { data, error } = await serviceClient.rpc("report_presenter_av_check", {
        p_session_id: sessionRows[0].id,
        p_connection_state: body.connectionState,
        p_av_check_passed: body.avCheckPassed ?? false,
      });
      if (error) return jsonResponse({ error: error.message }, 403);
      session = data as Record<string, unknown>;
    }

    if (!session) return jsonResponse({ error: "Could not update broadcast state" }, 500);
    const provider = await switchProviderSource(session);
    const { data: healthEvent } = await serviceClient
      .from("event_broadcast_health_events")
      .select("id")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (healthEvent?.id) {
      await serviceClient
        .from("event_broadcast_health_events")
        .update({ provider_switch_status: provider.status, provider_error: provider.error })
        .eq("id", healthEvent.id);
    }

    return jsonResponse({ success: true, session, provider });
  } catch (error) {
    console.error(
      "Broadcast failover failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return jsonResponse({ error: "Unable to update broadcast state" }, 500);
  }
});
