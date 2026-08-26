import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@^11.0.0";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const limited = await rateLimiter(req, "webauthn-register", 5, 60);
  if (limited) return limited;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const user = await verifyAuth(req, supabase);

    const body = await req.json();
    const action = body.action;

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const rpID = new URL(origin).hostname;

    if (action === "generate-options") {
      const { data: existingPasskeys } = await supabase
        .from("user_passkeys")
        .select("credential_id, transports")
        .eq("user_id", user.id);

      const options = await generateRegistrationOptions({
        rpName: "CampusConnect",
        rpID,
        userID: stringToUint8Array(user.id),
        userName: user.email || "user",
        userDisplayName: user.user_metadata?.full_name || user.email || "User",
        attestationType: "none",
        excludeCredentials: (existingPasskeys || []).map((pk) => ({
          id: pk.credential_id,
          transports: pk.transports || [],
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

      await supabase.from("webauthn_challenges").insert({
        user_id: user.id,
        email: user.email,
        challenge: options.challenge,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

      return new Response(JSON.stringify(options), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { registrationResponse, name } = body;

      const { data: challenges, error: challengeErr } = await supabase
        .from("webauthn_challenges")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (challengeErr || !challenges || challenges.length === 0) {
        return new Response(
          JSON.stringify({ error: "Registration challenge not found or expired" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const dbChallenge = challenges[0];

      const verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge: dbChallenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return new Response(JSON.stringify({ error: "Verification failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { credential, deviceType, credentialBackedUp } = verification.registrationInfo;
      const publicKeyBase64 = uint8ArrayToBase64Url(credential.publicKey);

      const { error: insertErr } = await supabase.from("user_passkeys").insert({
        user_id: user.id,
        credential_id: credential.id,
        public_key: publicKeyBase64,
        counter: credential.counter,
        transports: registrationResponse.response?.transports || [],
        device_type: deviceType,
        backed_up: credentialBackedUp,
        name: name || "Passkey",
      });

      if (insertErr) {
        throw insertErr;
      }

      await supabase.from("webauthn_challenges").delete().eq("id", dbChallenge.id);

      return new Response(JSON.stringify({ verified: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
