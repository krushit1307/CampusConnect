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

  // Rate limit
  const limited = await rateLimiter(req, "governance-action", 20, 60);
  if (limited) return limited;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Auth client
    const supabaseUserClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authErr,
    } = await supabaseUserClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    // Admin client for DB writes
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, actionType, payload } = body;

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const rpID = new URL(origin).hostname;

    if (action === "generate-challenge") {
      const { data: passkeys } = await supabaseAdmin
        .from("user_passkeys")
        .select("credential_id, transports")
        .eq("user_id", user.id);

      if (!passkeys || passkeys.length === 0) {
        throw new Error("No passkeys registered for this user.");
      }

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: passkeys.map((pk) => ({
          id: pk.credential_id,
          transports: pk.transports || [],
        })),
        userVerification: "preferred",
      });

      await supabaseAdmin.from("governance_challenges").insert({
        challenge: options.challenge,
        user_id: user.id,
        action_type: actionType,
        action_payload: payload,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

      return new Response(JSON.stringify(options), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "execute") {
      const { authenticationResponse } = body;

      if (!authenticationResponse || !authenticationResponse.id) {
        throw new Error("Invalid authentication response");
      }

      const { data: passkeyData, error: pkErr } = await supabaseAdmin
        .from("user_passkeys")
        .select("*")
        .eq("credential_id", authenticationResponse.id)
        .eq("user_id", user.id)
        .single();

      if (pkErr || !passkeyData) {
        throw new Error("Passkey credential not registered for this user");
      }

      // Verify the challenge
      // We look for a challenge that hasn't expired and matches the user
      // SimpleWebAuthn's verifyAuthenticationResponse handles the exact challenge match, but we need to fetch the challenge string first.
      // Since we don't know WHICH challenge string the frontend is answering (it sends clientDataJSON which contains the challenge),
      // we must extract the challenge from clientDataJSON to look it up in the DB.

      const clientDataJSON = atob(
        authenticationResponse.response.clientDataJSON.replace(/-/g, "+").replace(/_/g, "/"),
      );
      const clientData = JSON.parse(clientDataJSON);
      const expectedChallengeBase64 = clientData.challenge;

      const { data: challengeRecord, error: challengeErr } = await supabaseAdmin
        .from("governance_challenges")
        .select("*")
        .eq("challenge", expectedChallengeBase64)
        .eq("user_id", user.id)
        .single();

      if (challengeErr || !challengeRecord) {
        throw new Error("Invalid or expired challenge");
      }

      if (new Date(challengeRecord.expires_at) < new Date()) {
        throw new Error("Authentication challenge expired");
      }

      const publicKeyBytes = base64UrlToUint8Array(passkeyData.public_key);

      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: passkeyData.credential_id,
          credentialPublicKey: publicKeyBytes,
          counter: Number(passkeyData.counter),
          transports: passkeyData.transports,
        },
      });

      if (!verification.verified) {
        throw new Error("WebAuthn verification failed");
      }

      // Delete the used challenge
      await supabaseAdmin
        .from("governance_challenges")
        .delete()
        .eq("challenge", challengeRecord.challenge);

      // --- EXECUTE THE GOVERNANCE ACTION ---

      if (challengeRecord.action_type === "impeachment") {
        const { clubId, targetUserId, reason } = challengeRecord.action_payload;

        // Verify user is member of club
        const { data: membership } = await supabaseAdmin
          .from("club_members")
          .select("role")
          .eq("club_id", clubId)
          .eq("user_id", user.id)
          .eq("status", "approved")
          .single();

        if (!membership) throw new Error("Not a member of this club");

        const { error: insertErr } = await supabaseAdmin.from("impeachment_votes").insert({
          club_id: clubId,
          target_user_id: targetUserId,
          voter_user_id: user.id,
          reason: reason,
        });

        if (insertErr) {
          if (insertErr.code === "23505")
            throw new Error("You have already cast an impeachment vote against this user.");
          throw new Error("Failed to record impeachment vote: " + insertErr.message);
        }

        return new Response(
          JSON.stringify({ success: true, message: "Impeachment vote cast successfully." }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } else if (challengeRecord.action_type === "treasury_transfer") {
        const { reimbursementId } = challengeRecord.action_payload;

        // Rather than duplicating process-reimbursement logic, we can just invoke it as an admin,
        // OR since we are inside the edge function, we can invoke it via Supabase client, but process-reimbursement requires the user's auth header.
        // Wait, if we invoke process-reimbursement passing the user's authHeader, it will just work!
        const { data: prData, error: prError } = await supabaseAdmin.functions.invoke(
          "process-reimbursement",
          {
            body: { reimbursement_id: reimbursementId },
            headers: { Authorization: authHeader }, // Forward the user's auth header so it verifies their RLS
          },
        );

        if (prError)
          throw new Error(
            "Failed to process transfer: " + (prError.message || JSON.stringify(prError)),
          );
        if (prData.error) throw new Error(prData.error);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Treasury transfer approved.",
            transfer_id: prData.transfer_id,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      throw new Error("Unknown action type");
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    console.error("[GovernanceAction] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
