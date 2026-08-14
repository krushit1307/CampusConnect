import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "npm:@simplewebauthn/server@^11.0.0";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64UrlToUint8Array(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate limit: 10 requests/minute (authentication)
  const limited = await rateLimiter(req, "webauthn-authenticate", 10, 60);
  if (limited) return limited;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const action = body.action;

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const rpID = new URL(origin).hostname;

    if (action === "generate-options") {
      const email = body.email;
      let userPasskeys: { credential_id: string; transports: string[] }[] = [];
      let targetUserId: string | null = null;

      if (email) {
        const { data: usersData } = await supabase.auth.admin.listUsers();
        const foundUser = usersData.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase(),
        );

        if (foundUser) {
          targetUserId = foundUser.id;
          const { data: passkeys } = await supabase
            .from("user_passkeys")
            .select("credential_id, transports")
            .eq("user_id", foundUser.id);
          if (passkeys) {
            userPasskeys = passkeys;
          }
        }
      }

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: userPasskeys.map((pk) => ({
          id: pk.credential_id,
          transports: pk.transports || [],
        })),
        userVerification: "preferred",
      });

      await supabase.from("webauthn_challenges").insert({
        user_id: targetUserId,
        email: email || null,
        challenge: options.challenge,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

      return new Response(JSON.stringify(options), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { authenticationResponse, email } = body;

      if (!authenticationResponse || !authenticationResponse.id) {
        return new Response(JSON.stringify({ error: "Invalid authentication response" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: passkeys, error: pkErr } = await supabase
        .from("user_passkeys")
        .select("*")
        .eq("credential_id", authenticationResponse.id)
        .limit(1);

      if (pkErr || !passkeys || passkeys.length === 0) {
        return new Response(
          JSON.stringify({ error: "Passkey credential not registered on this device" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const passkey = passkeys[0];

      const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(
        passkey.user_id,
      );

      if (userErr || !userData || !userData.user || !userData.user.email) {
        return new Response(JSON.stringify({ error: "Associated user account not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userEmail = userData.user.email;

      const { data: challenges } = await supabase
        .from("webauthn_challenges")
        .select("*")
        .or(`user_id.eq.${passkey.user_id},email.eq.${userEmail},email.eq.${email || ""}`)
        .order("created_at", { ascending: false })
        .limit(1);

      let challengeString = "";
      if (challenges && challenges.length > 0) {
        challengeString = challenges[0].challenge;
      } else {
        const { data: latestChallenges } = await supabase
          .from("webauthn_challenges")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1);
        if (!latestChallenges || latestChallenges.length === 0) {
          return new Response(JSON.stringify({ error: "Authentication challenge expired" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        challengeString = latestChallenges[0].challenge;
      }

      const publicKeyBytes = base64UrlToUint8Array(passkey.public_key);

      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: challengeString,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: passkey.credential_id,
          credentialPublicKey: publicKeyBytes,
          counter: Number(passkey.counter),
          transports: passkey.transports,
        },
      });

      if (!verification.verified || !verification.authenticationInfo) {
        return new Response(JSON.stringify({ error: "WebAuthn verification failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("user_passkeys")
        .update({
          counter: verification.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", passkey.id);

      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: userEmail,
      });

      if (linkError || !linkData?.properties) {
        throw linkError || new Error("Failed to generate auth token");
      }

      return new Response(
        JSON.stringify({
          verified: true,
          token_hash: linkData.properties.hashed_token,
          email_otp: linkData.properties.email_otp,
          email: userEmail,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
