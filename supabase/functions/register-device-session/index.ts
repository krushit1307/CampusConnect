import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { getSessionIdFromToken } from "../shared/session-token.ts";
import { parseUserAgent } from "../shared/device-info.ts";
import {
  getFingerprintFromRequest,
  getIpSubnet,
  getRequestIp,
  hmacHex,
} from "../shared/replay-detection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-fingerprint",
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

    // The access token carries the id of the underlying auth.sessions row,
    // which is the unique key this device session is tracked under.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const sessionId = getSessionIdFromToken(token);

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Unable to determine session" }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    let body: { user_agent?: string; deviceFingerprint?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine; fall back to the User-Agent header.
    }

    const userAgent = body.user_agent || req.headers.get("user-agent") || "";
    const { device_info, browser, os } = parseUserAgent(userAgent);

    const ipAddress = getRequestIp(req);
    const fingerprint = getFingerprintFromRequest(req, body);

    // Bind this session to the context that minted it so token replay
    // can be detected later. Only HMAC digests are stored — never the
    // raw fingerprint or IP address.
    const bindingSecret = Deno.env.get("REPLAY_BINDING_SECRET") ?? "";
    const [fingerprintHash, ipSubnetHash] = await Promise.all([
      fingerprint ? hmacHex(fingerprint, bindingSecret) : Promise.resolve(null),
      ipAddress
        ? hmacHex(getIpSubnet(ipAddress) ?? ipAddress, bindingSecret)
        : Promise.resolve(null),
    ]);

    const { error } = await supabase.from("device_sessions").upsert(
      {
        user_id: user.id,
        auth_session_id: sessionId,
        device_info,
        browser,
        os,
        ip_address: ipAddress,
        user_agent: userAgent,
        fingerprint_hash: fingerprintHash,
        ip_subnet_hash: ipSubnetHash,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: "auth_session_id" },
    );

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Register device session error:", error);

    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
