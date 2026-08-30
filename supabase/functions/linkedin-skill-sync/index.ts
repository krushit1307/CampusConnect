import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
async function cryptoKey() {
  const secret = Deno.env.get("LINKEDIN_TOKEN_ENCRYPTION_KEY");
  if (!secret) throw new Error("LINKEDIN_TOKEN_ENCRYPTION_KEY is not configured");
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await cryptoKey(),
    encoder.encode(token),
  );
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}
async function decryptToken(value: string) {
  const [iv, ciphertext] = value.split(".");
  if (!iv || !ciphertext) throw new Error("Malformed encrypted LinkedIn token");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    await cryptoKey(),
    fromBase64(ciphertext),
  );
  return decoder.decode(decrypted);
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url } });
}
function appUrl() {
  return (Deno.env.get("APP_URL") || "https://campusconnect.app").replace(/\/$/, "");
}
function functionUrl() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
  return `${supabaseUrl}/functions/v1/linkedin-skill-sync`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      if (error || !code || !state) return redirect(`${appUrl()}/settings?linkedin=cancelled`);

      const stateHash = await digest(state);
      const { data: oauthState, error: stateError } = await admin
        .from("linkedin_oauth_states")
        .select("user_id, expires_at, consumed_at")
        .eq("state_hash", stateHash)
        .maybeSingle();
      if (
        stateError ||
        !oauthState ||
        oauthState.consumed_at ||
        new Date(oauthState.expires_at) < new Date()
      ) {
        return redirect(`${appUrl()}/settings?linkedin=invalid_state`);
      }

      const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
      const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET");
      if (!clientId || !clientSecret)
        return redirect(`${appUrl()}/settings?linkedin=not_configured`);
      const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: functionUrl(),
        }),
      });
      if (!tokenResponse.ok) return redirect(`${appUrl()}/settings?linkedin=token_error`);
      const token = await tokenResponse.json();
      const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!profileResponse.ok) return redirect(`${appUrl()}/settings?linkedin=profile_error`);
      const linkedinProfile = await profileResponse.json();
      const encrypted = await encryptToken(token.access_token);
      const { error: upsertError } = await admin.from("linkedin_connections").upsert({
        user_id: oauthState.user_id,
        linkedin_person_urn: linkedinProfile.sub,
        access_token_ciphertext: encrypted,
        access_token_expires_at: new Date(
          Date.now() + Number(token.expires_in || 5184000) * 1000,
        ).toISOString(),
        scopes: String(token.scope || "")
          .split(" ")
          .filter(Boolean),
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw upsertError;
      await admin
        .from("linkedin_oauth_states")
        .update({ consumed_at: new Date().toISOString() })
        .eq("state_hash", stateHash);
      return redirect(`${appUrl()}/settings?linkedin=connected`);
    }

    const user = await verifyAuth(req, admin);
    const body = await req.json();
    const action = body?.action;
    if (action === "authorize") {
      const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
      if (!clientId) return json({ error: "LinkedIn integration is not configured yet." }, 503);
      const state = base64(crypto.getRandomValues(new Uint8Array(32)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const stateHash = await digest(state);
      const { error } = await admin.from("linkedin_oauth_states").insert({
        user_id: user.id,
        state_hash: stateHash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (error) throw error;
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: functionUrl(),
        state,
        scope: "openid profile w_member_social",
      });
      return json({
        authorization_url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
      });
    }

    if (action === "sync") {
      const skill = String(body.skill || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 120);
      if (!skill) return json({ error: "A certificate skill is required." }, 400);
      const { data: certificate, error: certificateError } = await admin
        .from("verified_certificates")
        .select("id, series_name, user_name, completion_date, verification_hash")
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (certificateError) throw certificateError;
      if (!certificate)
        return json({ error: "No verified event-series certificate is available to sync." }, 404);
      const verificationUrl = `${appUrl()}/verify-certificate?hash=${encodeURIComponent(certificate.verification_hash)}`;
      const { data: connection, error: connectionError } = await admin
        .from("linkedin_connections")
        .select("linkedin_person_urn, access_token_ciphertext")
        .eq("user_id", user.id)
        .maybeSingle();
      if (connectionError) throw connectionError;
      if (!connection)
        return json({ status: "needs_reconnect", verification_url: verificationUrl }, 409);
      const token = await decryptToken(connection.access_token_ciphertext);
      const completed = new Date(`${certificate.completion_date}T00:00:00Z`);
      const payload = {
        authority: {
          localized: { en_US: "CampusConnect" },
          preferredLocale: { country: "US", language: "en" },
        },
        name: {
          localized: { en_US: `${skill} — ${certificate.series_name}` },
          preferredLocale: { country: "US", language: "en" },
        },
        licenseNumber: {
          localized: { en_US: `CampusConnect-${certificate.id}` },
          preferredLocale: { country: "US", language: "en" },
        },
        startMonthYear: { month: completed.getUTCMonth() + 1, year: completed.getUTCFullYear() },
        url: verificationUrl,
      };
      const { data: existing } = await admin
        .from("linkedin_certificate_syncs")
        .select("status, linkedin_certification_id")
        .eq("certificate_id", certificate.id)
        .maybeSingle();
      if (existing?.status === "synced")
        return json({
          status: "synced",
          verification_url: verificationUrl,
          linkedin_certification_id: existing.linkedin_certification_id,
        });
      const response = await fetch(
        `https://api.linkedin.com/v2/people/id=${encodeURIComponent(connection.linkedin_person_urn)}/certifications`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify(payload),
        },
      );
      const responseText = await response.text();
      const status = response.ok
        ? "synced"
        : response.status === 401
          ? "needs_reconnect"
          : response.status === 403
            ? "unavailable"
            : "failed";
      await admin.from("linkedin_certificate_syncs").upsert({
        certificate_id: certificate.id,
        user_id: user.id,
        skill_name: skill,
        verification_url: verificationUrl,
        status,
        linkedin_certification_id: response.headers.get("x-linkedin-id"),
        attempts: (existing ? 1 : 0) + 1,
        last_error: response.ok ? null : responseText.slice(0, 500),
        synced_at: response.ok ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
      return json(
        {
          status,
          verification_url: verificationUrl,
          linkedin_certification_id: response.headers.get("x-linkedin-id"),
          message: response.ok
            ? "Certification synced to LinkedIn."
            : "LinkedIn could not accept this update. Your verification link is ready to share.",
        },
        response.ok ? 200 : 502,
      );
    }
    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("[LinkedInSkillSync]", error);
    return json(
      { error: error instanceof Error ? error.message : "Unexpected synchronization error." },
      500,
    );
  }
});
