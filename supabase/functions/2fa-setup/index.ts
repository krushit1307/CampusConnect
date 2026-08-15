// =============================================================================
// Edge Function: 2FA Setup
// Issue: #2386 - Implement Time-Based One-Time Password (TOTP) 2FA system
// Description: Handles the generation of TOTP secrets, QR codes, and initial
// verification to enable Two-Factor Authentication for club administrators.
// Dependencies: otplib, qrcode (via esm.sh)
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticator } from "https://esm.sh/otplib@12.0.1";
import * as qrcode from "https://esm.sh/qrcode@1.5.3";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with the user's JWT to enforce RLS
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    // Get the authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized: User not authenticated");
    }

    // Parse request body to determine if this is a setup request or verify request
    const { action, code } = await req.json();

    if (action === "generate") {
      // Step 1: Generate a secure secret using otplib
      const secret = authenticator.generateSecret();

      // Step 2: Generate standard otpauth:// URI
      const otpauth = authenticator.keyuri(
        user.email ?? "user@campusconnect.com",
        "CampusConnect",
        secret,
      );

      // Step 3: Render the URI as a base64 Data URL using qrcode
      const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

      // Step 4: Save the secret in the DB (encrypted via trigger)
      // We temporarily store it until the user verifies the code
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ totp_secret: secret, is_2fa_enabled: false })
        .eq("id", user.id);

      if (dbError) throw dbError;

      return new Response(JSON.stringify({ secret, qrCodeDataUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "verify_setup") {
      if (!code || typeof code !== "string") {
        throw new Error("Invalid code provided");
      }

      // Fetch the user's current secret
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("totp_secret")
        .eq("id", user.id)
        .single();

      if (fetchError || !profile?.totp_secret) {
        throw new Error("No active 2FA setup session found");
      }

      // Strip the 'ENC:' prefix added by the DB trigger for verification
      const cleanSecret = profile.totp_secret.replace("ENC:", "");

      // Verify the 6-digit code with a window of 1 to account for time drift
      authenticator.options = { window: 1 };
      const isValid = authenticator.check(code, cleanSecret);

      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid TOTP code. Please try again." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // If valid, permanently enable 2FA for the account
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_2fa_enabled: true })
        .eq("id", user.id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, message: "2FA successfully enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Invalid action specified");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
