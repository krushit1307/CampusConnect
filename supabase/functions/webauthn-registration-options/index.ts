import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import {
  encode as base64urlEncode,
} from "https://deno.land/std@0.168.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RP_NAME = "CampusConnect";
const CHALLENGE_TTL_SECONDS = 300; // 5 minutes

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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Authenticate the user
    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body for RP ID and origin
    const body = await req.json().catch(() => ({}));
    const rpId = body.rpId;
    const deviceName = body.deviceName || null;

    if (!rpId) {
      return new Response(JSON.stringify({ error: "Missing rpId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's profile for display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, full_name")
      .eq("id", user.id)
      .maybeSingle();

    // Build display name: prefer first+last, fall back to full_name, then email
    const displayName = profile
      ? (
        `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
        profile.full_name ||
        user.email ||
        "User"
      )
      : (user.email || "User");

    // Fetch existing credentials to exclude (prevent re-registration)
    const { data: existingCreds } = await supabase
      .from("webauthn_credentials")
      .select("credential_id")
      .eq("user_id", user.id);

    const excludeCredentials = (existingCreds || []).map(
      (cred: { credential_id: string }) => ({
        id: cred.credential_id,
        type: "public-key" as const,
      }),
    );

    // Generate cryptographically secure random challenge (32 bytes)
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const challenge = base64urlEncode(challengeBytes);

    // Clean up any existing registration challenges for this user
    await supabase
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", user.id)
      .eq("type", "registration");

    // Store challenge in DB with TTL
    const expiresAt = new Date(
      Date.now() + CHALLENGE_TTL_SECONDS * 1000,
    ).toISOString();

    const { error: challengeError } = await supabase
      .from("webauthn_challenges")
      .insert({
        user_id: user.id,
        challenge,
        type: "registration",
        expires_at: expiresAt,
      });

    if (challengeError) {
      console.error("Failed to store challenge:", challengeError);
      return new Response(
        JSON.stringify({ error: "Failed to generate registration options" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build WebAuthn PublicKeyCredentialCreationOptions
    const options = {
      challenge,
      rp: {
        name: RP_NAME,
        id: rpId,
      },
      user: {
        id: base64urlEncode(new TextEncoder().encode(user.id)),
        name: user.email || user.id,
        displayName,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },   // ES256
        { alg: -257, type: "public-key" },  // RS256
      ],
      excludeCredentials,
      authenticatorSelection: {
        // Do NOT restrict authenticatorAttachment to "platform" — this would block
        // Security Keys (YubiKey, etc.) and cross-platform authenticators.
        // Let the browser and user choose the authenticator type.
        residentKey: "preferred" as const,
        userVerification: "preferred" as const,
      },
      timeout: CHALLENGE_TTL_SECONDS * 1000,
      attestation: "none" as const,
    };

    return new Response(JSON.stringify({ options }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("WebAuthn registration options error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
