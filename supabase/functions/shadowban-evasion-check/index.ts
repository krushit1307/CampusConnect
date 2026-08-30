import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-fingerprint",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_FINGERPRINTS = new Set(["fallback-anonymous-id", "", "unknown", "null"]);

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeFingerprint(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    normalized.length < 16 ||
    normalized.length > 256 ||
    FALLBACK_FINGERPRINTS.has(normalized.toLowerCase()) ||
    !/^[a-zA-Z0-9._:-]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function getRequestIp(req: Request): string | null {
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0],
  ];
  const value = candidates.find((candidate) => candidate?.trim());
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length <= 128 ? normalized : null;
}

async function hmacHex(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getFingerprintFromRequest(req: Request, body: Record<string, unknown>): string | null {
  return normalizeFingerprint(req.headers.get("x-device-fingerprint") ?? body.deviceFingerprint);
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: true });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const signatureSecret = Deno.env.get("SHADOWBAN_SIGNATURE_SECRET") ?? "";

    // The detector is deliberately fail-open for authentication. A missing secret
    // must never turn a successful login into an authentication failure.
    if (!supabaseUrl || !anonKey || !serviceRoleKey || signatureSecret.length < 16) {
      return json({ success: true });
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const user = await verifyAuth(req, authClient);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const fingerprint = getFingerprintFromRequest(req, body);
    const ipAddress = getRequestIp(req);

    if (!fingerprint && !ipAddress) return json({ success: true });

    const [ipHash, deviceFingerprintHash] = await Promise.all([
      ipAddress ? hmacHex(ipAddress, signatureSecret) : Promise.resolve(null),
      fingerprint ? hmacHex(fingerprint, signatureSecret) : Promise.resolve(null),
    ]);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("is_shadowbanned")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) return json({ success: true });

    if (profile.is_shadowbanned) {
      let existingQuery = admin
        .from("banned_signatures")
        .select("id")
        .eq("source_user_id", user.id);
      existingQuery = ipHash
        ? existingQuery.eq("ip_hash", ipHash)
        : existingQuery.is("ip_hash", null);
      existingQuery = deviceFingerprintHash
        ? existingQuery.eq("device_fingerprint_hash", deviceFingerprintHash)
        : existingQuery.is("device_fingerprint_hash", null);
      const { data: existing } = await existingQuery.limit(1).maybeSingle();

      if (existing?.id) {
        await admin
          .from("banned_signatures")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await admin.from("banned_signatures").insert({
          source_user_id: user.id,
          ip_hash: ipHash,
          device_fingerprint_hash: deviceFingerprintHash,
          reason: "Signature captured from an existing shadowbanned account.",
        });
      }

      return json({ success: true });
    }

    const clauses = [
      ipHash ? `ip_hash.eq.${ipHash}` : null,
      deviceFingerprintHash ? `device_fingerprint_hash.eq.${deviceFingerprintHash}` : null,
    ].filter(Boolean);

    if (clauses.length === 0) return json({ success: true });

    const { data: matchedSignatures } = await admin
      .from("banned_signatures")
      .select("id, source_user_id, ip_hash, device_fingerprint_hash")
      .eq("active", true)
      .or(clauses.join(","))
      .limit(1);

    const match = matchedSignatures?.[0];
    if (!match) return json({ success: true });

    await admin.from("profiles").update({ is_shadowbanned: true }).eq("id", user.id);

    await admin.from("shadowbanned_users").upsert({
      user_id: user.id,
      reason: "Automated shadowban evasion signature match.",
    });

    await admin
      .from("banned_signatures")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", match.id);

    // Always return the same successful response. Detection must not reveal which
    // identity dimension matched or change the account's login experience.
    return json({ success: true });
  } catch (error) {
    console.error("[shadowban-evasion-check] non-blocking detector error", error);
    return json({ success: true });
  }
}

serve(handler);
