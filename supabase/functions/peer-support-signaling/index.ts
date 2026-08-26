// =============================================================================
// File: supabase/functions/peer-support-signaling/index.ts
// Issue: #4296 - Develop a 'Dynamic "Mental Health" Peer Support Matcher'
// Description: Supabase Edge Function for WebRTC/WebSocket ephemeral signaling
//              between anonymous students and certified peer listeners.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EphemeralSignalPayload {
  sessionId: string;
  topic: string;
  moodRating: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: EphemeralSignalPayload = await req.json();

    // Call RPC to register anonymous session
    const { data, error } = await supabaseClient.rpc("request_peer_support_rpc", {
      p_session_id: body.sessionId,
      p_topic: body.topic,
      p_mood_rating: body.moodRating,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: body.sessionId,
        data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
