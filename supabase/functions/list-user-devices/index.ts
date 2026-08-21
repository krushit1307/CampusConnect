import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { getSessionIdFromToken } from "../shared/session-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Identify the requesting device session so the response can flag it
    // as the current device.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const currentSessionId = getSessionIdFromToken(token);

    const { data: sessions, error } = await supabase
      .from("device_sessions")
      .select("id, browser, os, ip_address, auth_session_id, last_active_at")
      .eq("user_id", user.id)
      .order("last_active_at", { ascending: false });

    if (error) {
      throw error;
    }

    const response = (sessions ?? []).map((session) => ({
      id: session.id,
      browser: session.browser ?? "",
      os: session.os ?? "",
      ip_address: session.ip_address ?? "",
      location: "",
      last_login_at: session.last_active_at,
      is_current: currentSessionId !== null && session.auth_session_id === currentSessionId,
    }));

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("List user devices error:", error);

    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
