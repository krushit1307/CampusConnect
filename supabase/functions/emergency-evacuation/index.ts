import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) throw new Error("Missing Authorization");

    // Verify bouncer is authenticated (optional service-role bypass for iPad background thread with stored JWT)
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData?.user) throw new Error("Unauthorized bouncer");

    const body = await req.json();
    if (body.type !== "EMERGENCY_EVACUATION") throw new Error("Invalid payload type");
    const { eventId, bouncerId, detectionDurationSeconds, peakFreqHz, venueId } = body as {
      eventId: string;
      bouncerId: string;
      detectionDurationSeconds: number;
      peakFreqHz: number | null;
      venueId?: string | null;
    };
    if (!eventId || !bouncerId) throw new Error("eventId and bouncerId required");
    if (typeof detectionDurationSeconds !== "number" || detectionDurationSeconds < 5) throw new Error("T3 must be detected >5 seconds");

    // High-priority: call RPC that drops magnetic locks atomically
    const { data, error } = await supabase.rpc("trigger_emergency_evacuation", {
      p_event_id: eventId,
      p_bouncer_id: bouncerId,
      p_detection_duration_seconds: detectionDurationSeconds,
      p_payload: { ...body, peakFreqHz, venueId },
    });
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, ...data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isAuth = message.toLowerCase().includes("unauthorized");
    return new Response(JSON.stringify({ error: message }), {
      status: isAuth ? 401 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
