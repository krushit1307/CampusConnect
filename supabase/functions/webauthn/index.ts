import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "https://esm.sh/@simplewebauthn/server@8.3.5";

const RP_NAME = "CampusConnect";
const RP_ID = Deno.env.get("RP_ID") || "localhost";
const ORIGIN = Deno.env.get("ORIGIN") || "http://localhost:3000";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { action, payload, userId } = await req.json();

  try {
    switch (action) {
      case "generate-registration-options": {
        const { data: user } = await supabase.auth.admin.getUserById(userId);
        const { data: userAuthenticators } = await supabase
          .from("user_authenticators")
          .select("credential_id, transports")
          .eq("user_id", userId);

        const options = await generateRegistrationOptions({
          rpName: RP_NAME,
          rpID: RP_ID,
          userID: new TextEncoder().encode(userId),
          userName: user?.user?.email || "User",
          attestationType: "none",
          excludeCredentials: (userAuthenticators || []).map((auth) => ({
            id: auth.credential_id,
            transports: auth.transports,
          })),
          authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "preferred",
          },
        });

        return new Response(JSON.stringify(options), { status: 200 });
      }

      case "verify-registration": {
        const { response, expectedChallenge } = payload;

        const verification = await verifyRegistrationResponse({
          response,
          expectedChallenge,
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
        });

        if (verification.verified && verification.registrationInfo) {
          const { credentialID, credentialPublicKey, counter } =
            verification.registrationInfo;

          await supabase.from("user_authenticators").insert({
            user_id: userId,
            credential_id: credentialID,
            public_key: Buffer.from(credentialPublicKey),
            counter,
            transports: response.response.transports || [],
          });

          return new Response(JSON.stringify({ verified: true }), { status: 200 });
        }
        return new Response(JSON.stringify({ verified: false }), { status: 400 });
      }

      case "generate-authentication-options": {
        const { data: userAuthenticators } = await supabase
          .from("user_authenticators")
          .select("credential_id, transports")
          .eq("user_id", userId);

        if (!userAuthenticators || userAuthenticators.length === 0) {
          return new Response(
            JSON.stringify({ error: "No hardware authenticators registered" }),
            { status: 400 }
          );
        }

        const options = await generateAuthenticationOptions({
          rpID: RP_ID,
          allowCredentials: userAuthenticators.map((auth) => ({
            id: auth.credential_id,
            transports: auth.transports,
          })),
          userVerification: "preferred",
        });

        return new Response(JSON.stringify(options), { status: 200 });
      }

      case "verify-authentication": {
        const { response, expectedChallenge } = payload;
        const { data: dbAuth } = await supabase
          .from("user_authenticators")
          .select("*")
          .eq("credential_id", response.id)
          .single();

        if (!dbAuth) {
          return new Response(JSON.stringify({ error: "Authenticator not found" }), {
            status: 400,
          });
        }

        const verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge,
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
          authenticator: {
            credentialID: dbAuth.credential_id,
            credentialPublicKey: Buffer.from(dbAuth.public_key),
            counter: Number(dbAuth.counter),
          },
        });

        if (verification.verified) {
          await supabase
            .from("user_authenticators")
            .update({
              counter: verification.authenticationInfo.newCounter,
              last_used_at: new Date().toISOString(),
            })
            .eq("id", dbAuth.id);

          return new Response(JSON.stringify({ verified: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ verified: false }), { status: 400 });
      }

      default:
        return new Response("Invalid action", { status: 400 });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
