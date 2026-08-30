import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/validation.ts";
import {
  identifyHardwareEncoder,
  injectHardwareCaptions,
  type HardwareEncoderConfig,
} from "../_shared/hardwareClosedCaptions.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function injectEventHardwareCaptions(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  deepgramPayload: unknown,
): Promise<{ injected: boolean; reason?: string }> {
  const { data, error } = await supabase
    .from("event_hardware_encoders")
    .select("encoder_type, rest_base_url, rtmp_url, channel_id")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return { injected: false, reason: "encoder_not_configured" };
  const encoderType = identifyHardwareEncoder(data.encoder_type);
  if (!encoderType) return { injected: false, reason: "unknown_encoder" };

  const encoder: HardwareEncoderConfig = {
    encoder_type: encoderType,
    rest_base_url: data.rest_base_url,
    rtmp_url: data.rtmp_url,
    channel_id: data.channel_id,
    api_token: Deno.env.get("HARDWARE_ENCODER_API_TOKEN") || null,
  };

  return injectHardwareCaptions(encoder, deepgramPayload);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      eventId?: string;
      chunk?: unknown;
    };
    if (!body.eventId) return json({ error: "Missing eventId" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const result = await injectEventHardwareCaptions(supabase, body.eventId, body.chunk);
    return json(result);
  } catch (err) {
    console.error("[inject-hardware-captions]", err);
    return json({ error: "Failed to inject hardware captions" }, 500);
  }
});
