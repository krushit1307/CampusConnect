import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { encode as base64urlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { parseJsonBody } from "../_shared/validation.ts";

// Optional body: auth options can be fetched with no body at all, but if
// one is provided it must be well-formed and reject unknown keys.
const authOptionsSchema = z
  .object({
    rpId: z.string().min(1),
    email: z.string().max(255, "email is too long").email("email must be a valid email address").optional(),
  })
  .strict();
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RP_NAME = "CampusConnect";
const CHALLENGE_TTL_SECONDS = 300; // 5 minutes

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
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

    // Body is optional; an empty body is valid, but a present body must
    // conform to the schema (rejecting unknown keys).
    const rawText = await req.text();
    const parsed = await parseJsonBody(
      authOptionsSchema,
      new Request(req.url, {
        method: "POST",
        headers: req.headers,
        body: rawText.trim() ? rawText : null,
      }),
    );
    if (!parsed.ok) return parsed.response;
    const { rpId, email } = parsed.data;

    if (!rpId) {
      return new Response(JSON.stringify({ error: "Missing rpId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate cryptographically secure random challenge (32 bytes)
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const challenge = base64urlEncode(challengeBytes);

    // Build allowCredentials list if email is provided.
    let allowCredentials: { id: string; type: string; transports?: string[] }[] = [];
    let userId: string | null = null;

    if (email) {
      // ---------------------------------------------------------------
      // SECURITY FIX: Replaced listUsers() + JS .find() O(n) scan with
      // a single targeted RPC that issues one SQL query against an
      // indexed column (auth.users.email).
      //
      // The RPC function `get_user_id_by_email` is SECURITY DEFINER and
      // is callable only by the service_role (see migration
      // 20260726000000_webauthn_user_lookup_rpc.sql).
      // ---------------------------------------------------------------
      const { data: lookupRows, error: lookupError } = await supabase.rpc("get_user_id_by_email", {
        target_email: email.toLowerCase().trim(),
      });

      if (lookupError) {
        console.error("User email lookup failed:", lookupError);
        // Treat as non-fatal: fall through with no allowCredentials
        // (discoverable credential flow still works)
      } else if (lookupRows && lookupRows.length > 0) {
        userId = lookupRows[0].user_id as string;

        // Fetch only this user's credentials — single-row join, fully indexed.
        const { data: creds } = await supabase
          .from("webauthn_credentials")
          .select("credential_id, transports")
          .eq("user_id", userId);

        if (creds && creds.length > 0) {
          allowCredentials = creds.map((c: { credential_id: string; transports: string[] }) => ({
            id: c.credential_id,
            type: "public-key",
            transports: c.transports || [],
          }));
        }
      }
      // If email provided but no user found: return empty allowCredentials.
      // Do NOT reveal whether the email exists (prevents user enumeration).
    }

    // ------------------------------------------------------------------
    // Stale-challenge sweep: delete any previous authentication challenges
    // for this user before inserting the new one. This prevents challenge
    // hoarding and ensures only one valid challenge exists per user at a
    // time.
    //
    // For discoverable-credential flows (userId=null), we sweep by IP or
    // skip — sweeping null rows would race with parallel users, so we
    // leave null-owner challenges to TTL expiry.
    // ------------------------------------------------------------------
    if (userId) {
      const { error: sweepError } = await supabase
        .from("webauthn_challenges")
        .delete()
        .eq("user_id", userId)
        .eq("type", "authentication");

      if (sweepError) {
        // Non-fatal: old challenges will expire via expires_at
        console.warn("Challenge sweep failed:", sweepError.message);
      }
    }

    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000).toISOString();

    const { error: challengeError } = await supabase.from("webauthn_challenges").insert({
      user_id: userId, // null for discoverable credential flow
      challenge,
      type: "authentication",
      expires_at: expiresAt,
    });

    if (challengeError) {
      console.error("Failed to store challenge:", challengeError);
      return new Response(
        JSON.stringify({
          error: "Failed to generate authentication options",
          details: challengeError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build WebAuthn PublicKeyCredentialRequestOptions
    const options = {
      challenge,
      rpId,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: "preferred",
      timeout: CHALLENGE_TTL_SECONDS * 1000,
    };

    return new Response(JSON.stringify({ options }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("WebAuthn auth options error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
