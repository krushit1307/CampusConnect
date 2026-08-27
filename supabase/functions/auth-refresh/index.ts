import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { corsHeaders, parseJsonBody } from "../_shared/validation.ts";

const refreshSchema = z
  .object({
    refresh_token: z.string().min(1, "refresh_token is required"),
  })
  .strict();

/**
 * Computes SHA-256 hash of a plain text refresh token.
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a secure random refresh token string.
 */
export function generateRefreshToken(): string {
  return "rt_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

/**
 * /api/auth/refresh endpoint for Refresh Token Rotation & Theft Detection.
 *
 * Implements token rotation on every use, with a 5-second grace period for
 * concurrent multi-tab requests and immediate user lockout on stolen token reuse.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = await parseJsonBody(refreshSchema, req);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { refresh_token: incomingRefreshToken } = parsed.data;

  // Initialize Supabase client with service role key
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Hash incoming token
  const incomingTokenHash = await hashToken(incomingRefreshToken);

  // Generate new refresh token and hash
  const newRefreshToken = generateRefreshToken();
  const newTokenHash = await hashToken(newRefreshToken);

  // Call rotate_refresh_token RPC in Postgres (with 5-second grace period)
  const { data, error } = await supabase.rpc("rotate_refresh_token", {
    p_token_hash: incomingTokenHash,
    p_new_token_hash: newTokenHash,
    p_grace_period_seconds: 5,
  });

  if (error) {
    return new Response(
      JSON.stringify({
        error: "Internal server error during token refresh",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const status = data?.status;

  if (status === "success") {
    // Generate new Access Token for user
    const newAccessToken = "at_" + crypto.randomUUID().replace(/-/g, "");
    return new Response(
      JSON.stringify({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: "bearer",
        expires_in: 3600,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (status === "grace_period") {
    // Return 200 within grace period (multi-tab concurrent refresh)
    const newAccessToken = "at_" + crypto.randomUUID().replace(/-/g, "");
    return new Response(
      JSON.stringify({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        message: "Token refreshed within grace period",
        token_type: "bearer",
        expires_in: 3600,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (status === "revoked_all") {
    // Theft detected! All user refresh tokens revoked
    return new Response(
      JSON.stringify({
        error:
          "Security alert: Stolen refresh token detected. All active sessions have been revoked. Please log in again with your password.",
        code: "STOLEN_TOKEN_REVOCATION",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Default invalid token failure
  return new Response(
    JSON.stringify({
      error: "Invalid or expired refresh token",
      code: "INVALID_REFRESH_TOKEN",
    }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
