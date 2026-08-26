import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { getSessionIdFromToken } from "../shared/session-token.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const revokeDeviceSchema = z
  .object({
    deviceId: z.string().uuid("deviceId must be a valid UUID"),
  })
  .strict();

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

    // Prevent a user from revoking the very session they are using right now.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const currentSessionId = getSessionIdFromToken(token);

    const parsed = await parseJsonBody(revokeDeviceSchema, req);
    if (!parsed.ok) return parsed.response;
    const { deviceId } = parsed.data;

    const { data: session, error: fetchError } = await supabase
      .from("device_sessions")
      .select("id, auth_session_id")
      .eq("id", deviceId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !session) {
      return new Response(JSON.stringify({ error: "Device not found" }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (currentSessionId !== null && session.auth_session_id === currentSessionId) {
      return new Response(JSON.stringify({ error: "Cannot revoke the current device session." }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 1. Invalidate the underlying Supabase auth session. Deleting the
    //    auth.sessions / auth.refresh_tokens rows kills the device's
    //    refresh token, so the next token refresh is rejected.
    const { error: revokeError } = await supabase.rpc("revoke_auth_session", {
      p_auth_session_id: session.auth_session_id,
    });

    if (revokeError) {
      throw revokeError;
    }

    // 2. Remove the tracked device session record.
    const { error: deleteError } = await supabase
      .from("device_sessions")
      .delete()
      .eq("id", deviceId)
      .eq("user_id", user.id);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Device removed successfully.",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Revoke device error:", error);

    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
