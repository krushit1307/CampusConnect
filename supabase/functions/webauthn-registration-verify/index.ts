import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { parseAuthenticatorData } from "../shared/crypto-verify.ts";
import {
  decode as base64urlDecode,
  encode as base64urlEncode,
} from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const webauthnRegistrationSchema = z
  .object({
    credentialId: z.string().min(1, "credentialId is required"),
    clientDataJSON: z.string().min(1, "clientDataJSON is required"),
    attestationObject: z.string().optional(),
    authenticatorData: z.string().min(1, "authenticatorData is required"),
    transports: z.array(z.string()).optional(),
    deviceName: z.string().max(100).optional(),
    rpId: z.string().optional(),
    origin: z.string().min(1, "origin is required"),
  })
  .strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const parsed = await parseJsonBody(webauthnRegistrationSchema, req);
    if (!parsed.ok) return parsed.response;
    const {
      credentialId,
      clientDataJSON,
      attestationObject,
      authenticatorData,
      transports,
      deviceName,
      rpId,
      origin,
    } = parsed.data;

    // origin is required — omitting it bypasses origin validation below
    if (!origin) {
      console.error({
        step: "validate_origin_presence",
        reason: "Missing origin parameter in body",
      });
      return new Response(JSON.stringify({ error: "Missing origin" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Retrieve and validate the stored challenge.
    //    Expiry is enforced in the WHERE clause so expired rows are never returned.
    //    maybeSingle() returns null (not an error) when no row is found.
    const now = new Date().toISOString();
    const { data: challengeRecord, error: challengeFetchError } = await supabase
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", user.id)
      .eq("type", "registration")
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (challengeFetchError) {
      console.error("Challenge lookup error:", challengeFetchError);
      return new Response(JSON.stringify({ error: "Challenge validation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!challengeRecord) {
      console.error({
        step: "challenge_lookup",
        reason: "No pending registration challenge found, or it has expired",
        user_id: user.id,
      });
      return new Response(
        JSON.stringify({ error: "No pending registration challenge found, or it has expired" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Decode and verify clientDataJSON
    const clientDataBytes = base64urlDecode(clientDataJSON);
    const clientDataText = new TextDecoder().decode(clientDataBytes);
    let clientData;
    try {
      clientData = JSON.parse(clientDataText);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid clientDataJSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify type
    if (clientData.type !== "webauthn.create") {
      console.error({
        step: "clientData_type",
        reason: "Invalid clientData type",
        expected: "webauthn.create",
        received: clientData.type,
      });
      return new Response(JSON.stringify({ error: "Invalid clientData type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify challenge matches
    if (clientData.challenge !== challengeRecord.challenge) {
      console.error({
        step: "challenge_match",
        reason: "Challenge mismatch",
        clientChallenge: clientData.challenge,
        recordChallenge: challengeRecord.challenge,
      });
      return new Response(JSON.stringify({ error: "Challenge mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify origin (W3C WebAuthn §7.2 step 13) — required, not optional
    if (clientData.origin !== origin) {
      console.error({
        step: "origin_match",
        reason: "Origin mismatch",
        clientOrigin: clientData.origin,
        expectedOrigin: origin,
      });
      return new Response(JSON.stringify({ error: "Origin mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Parse authenticator data
    let parsedAuthData;
    try {
      parsedAuthData = parseAuthenticatorData(base64urlDecode(authenticatorData));
      if (!parsedAuthData.userPresent) {
        console.error({
          step: "authenticator_data",
          reason: "User was not present during registration",
        });
        throw new Error("User was not present during registration");
      }
    } catch (e) {
      console.error({
        step: "authenticator_data",
        reason: `Invalid authenticator data: ${(e as Error).message}`,
      });
      return new Response(
        JSON.stringify({ error: `Invalid authenticator data: ${(e as Error).message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Check for duplicate credential
    const { data: existingCred } = await supabase
      .from("webauthn_credentials")
      .select("id")
      .eq("credential_id", credentialId)
      .limit(1)
      .maybeSingle();

    if (existingCred) {
      console.error({
        step: "duplicate_credential",
        reason: "This passkey is already registered",
        credentialId,
      });
      return new Response(JSON.stringify({ error: "This passkey is already registered" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Store the credential
    const publicKeyB64url = parsedAuthData.publicKeyBytes
      ? base64urlEncode(parsedAuthData.publicKeyBytes)
      : null;

    if (!publicKeyB64url) {
      console.error({
        step: "extract_public_key",
        reason: "Failed to extract public key (parsedAuthData.publicKeyBytes is null or empty)",
      });
      return new Response(JSON.stringify({ error: "Failed to extract public key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase.from("webauthn_credentials").insert({
      user_id: user.id,
      credential_id: credentialId,
      public_key: publicKeyB64url, // Store base64url-encoded COSE public key
      counter: parsedAuthData.signCount,
      transports: transports || [],
      device_name: deviceName || "Passkey",
      aaguid: parsedAuthData.aaguid,
      backed_up: parsedAuthData.backupState,
      last_used_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error({
        step: "db_insert",
        reason: "Failed to store credential",
        error: insertError,
      });
      return new Response(
        JSON.stringify({ error: "Failed to register passkey", details: insertError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 6. Delete the used challenge (atomic single-use consumption)
    const { data: deletedChallenge, error: deleteError } = await supabase
      .from("webauthn_challenges")
      .delete()
      .eq("id", challengeRecord.id)
      .select("id")
      .maybeSingle();

    if (deleteError || !deletedChallenge) {
      return new Response(JSON.stringify({ error: "Challenge already used or expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Passkey registered successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("WebAuthn registration verify error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
