import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64urlDecode } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import {
  verifySignature,
  parseAuthenticatorData,
  verifyRpIdHash,
} from "../shared/crypto-verify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

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

    const body = await req.json();
    const { credentialId, clientDataJSON, authenticatorData, signature, rpId, origin } = body;

    // Validate required fields
    if (!credentialId || !clientDataJSON || !authenticatorData || !signature) {
      return new Response(JSON.stringify({ error: "Missing required credential data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // origin is required — omitting it would bypass origin validation below
    if (!origin) {
      return new Response(JSON.stringify({ error: "Missing origin" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rpId) {
      return new Response(JSON.stringify({ error: "Missing rpId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Look up the credential by credential_id
    const { data: credential, error: credError } = await supabase
      .from("webauthn_credentials")
      .select("*")
      .eq("credential_id", credentialId)
      .single();

    if (credError || !credential) {
      return new Response(JSON.stringify({ error: "Unknown credential" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Decode and verify clientDataJSON first so we have the challenge
    //    value before touching the database.
    const clientDataBytes = base64urlDecode(clientDataJSON);
    const clientDataText = new TextDecoder().decode(clientDataBytes);
    let clientData: { type: string; challenge: string; origin: string };
    try {
      clientData = JSON.parse(clientDataText);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid clientDataJSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify operation type (W3C WebAuthn §7.2 step 11)
    if (clientData.type !== "webauthn.get") {
      return new Response(JSON.stringify({ error: "Invalid clientData type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify origin (W3C WebAuthn §7.2 step 13) — required, not optional
    if (clientData.origin !== origin) {
      return new Response(JSON.stringify({ error: "Origin mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Targeted challenge lookup by challenge value.
    //
    //    SECURITY DESIGN:
    //    The challenge string (32 bytes, base64url) is unique and unpredictable.
    //    We look it up directly using an equality filter — O(1), index-backed.
    //    We do NOT scan all challenges and match in JS (previous O(n) approach).
    //
    //    Ownership rules:
    //    a) challenge.user_id = credential.user_id  → normal named-user flow
    //    b) challenge.user_id IS NULL               → discoverable credential
    //       flow (no email provided at options time). Permitted because the
    //       authenticator is the authority on which credential to use.
    //    c) challenge.user_id = some OTHER user_id  → REJECT. A challenge
    //       issued for user A cannot be consumed by user B's credential.
    //
    //    Expiration is enforced in the WHERE clause (gt: expires_at > now())
    //    so expired rows are never returned — no application-side date check.
    const now = new Date().toISOString();
    const { data: challengeRecord, error: challengeFetchError } = await supabase
      .from("webauthn_challenges")
      .select("id, user_id, challenge, expires_at")
      .eq("challenge", clientData.challenge)
      .eq("type", "authentication")
      .gt("expires_at", now) // expired challenges never match
      .maybeSingle(); // expect 0 or 1 row; error on >1

    if (challengeFetchError) {
      console.error("Challenge lookup error:", challengeFetchError);
      return new Response(JSON.stringify({ error: "Challenge validation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No row → challenge not found, never issued, or already expired/consumed
    if (!challengeRecord) {
      return new Response(
        JSON.stringify({ error: "Challenge not found, expired, or already used" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Enforce challenge ownership (rule c above)
    if (challengeRecord.user_id !== null && challengeRecord.user_id !== credential.user_id) {
      // Log the anomaly — this indicates a cross-user replay attempt
      console.error(
        `[WebAuthn] Challenge ownership violation: ` +
          `challenge owned by ${challengeRecord.user_id}, ` +
          `credential owned by ${credential.user_id}`,
      );
      return new Response(
        JSON.stringify({ error: "Challenge does not belong to this credential" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Alias for the rest of the function
    const matchingChallenge = challengeRecord;

    // 4. Parse authenticator data and verify RP ID hash
    let parsedAuthData;
    try {
      parsedAuthData = parseAuthenticatorData(base64urlDecode(authenticatorData));
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: `Invalid authenticator data: ${(e as Error).message}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify user presence (W3C WebAuthn §7.2 step 17)
    if (!parsedAuthData.userPresent) {
      return new Response(JSON.stringify({ error: "User was not present during authentication" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify RP ID hash (W3C WebAuthn §7.2 step 16)
    const rpIdValid = await verifyRpIdHash(parsedAuthData.rpIdHash, rpId);
    if (!rpIdValid) {
      return new Response(JSON.stringify({ error: "RP ID mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Cryptographic signature verification
    //    Uses shared/crypto-verify.ts (handles ES256 + RS256, DER-encoded sigs)
    const publicKeyBytes = base64urlDecode(credential.public_key);
    const signatureBytes = base64urlDecode(signature);

    // clientDataHash = SHA-256(clientDataJSON raw bytes)  (W3C WebAuthn §7.2 step 19)
    const clientDataHash = new Uint8Array(
      await crypto.subtle.digest("SHA-256", base64urlDecode(clientDataJSON)),
    );

    const isSignatureValid = await verifySignature(
      publicKeyBytes,
      signatureBytes,
      clientDataHash,
      base64urlDecode(authenticatorData),
    );

    if (!isSignatureValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Replay-attack prevention: verify sign counter (W3C WebAuthn §7.2 step 21)
    const storedCounter = credential.counter || 0;
    if (parsedAuthData.signCount !== 0 && parsedAuthData.signCount <= storedCounter) {
      return new Response(
        JSON.stringify({
          error: "Possible cloned authenticator detected (counter did not increment)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 7. Update counter and last_used_at
    const { error: updateError } = await supabase
      .from("webauthn_credentials")
      .update({
        counter: parsedAuthData.signCount,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", credential.id);

    if (updateError) {
      console.error("Failed to update credential counter:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update credential counter" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Delete the consumed challenge (one-time use, atomic consumption)
    const { data: deleted, error: deleteError } = await supabase
      .from("webauthn_challenges")
      .delete()
      .eq("id", matchingChallenge.id)
      .select("id")
      .maybeSingle();

    if (deleteError || !deleted) {
      return new Response(JSON.stringify({ error: "Challenge already used or expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Retrieve the user record so the frontend can establish a session.
    //    Session creation (magic link / OTP exchange) is handled by the caller.
    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(
      credential.user_id,
    );

    if (authUserError || !authUser?.user) {
      return new Response(JSON.stringify({ error: "Failed to retrieve user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine the redirect origin for the magic link callback.
    // The frontend passes its origin so we can build the correct redirect URL.
    // Falls back to SITE_URL env-var, then a sensible default.
    const siteOrigin = origin || Deno.env.get("SITE_URL") || "http://localhost:5173";
    const redirectTo = `${siteOrigin}/auth/passkey-callback`;

    // Generate a magic link for the user.
    // - hashed_token: used by verifyOtp({ token_hash, type: "magiclink" }) on the frontend
    // - action_link:  fallback — the frontend can navigate to this URL directly
    //                 and Supabase will create the session automatically
    const { data: sessionLink, error: sessionError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.user.email!,
      options: { redirectTo },
    });

    if (sessionError || !sessionLink) {
      console.error("Failed to generate session link:", sessionError);
      return new Response(JSON.stringify({ error: "Failed to create session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenHash = sessionLink.properties?.hashed_token;
    const actionLink = sessionLink.properties?.action_link;

    return new Response(
      JSON.stringify({
        success: true,
        userId: credential.user_id,
        email: authUser.user.email,
        tokenHash,
        actionLink,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("WebAuthn auth verify error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
