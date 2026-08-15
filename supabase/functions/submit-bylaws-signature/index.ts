// Submit Bylaws Signature
// -----------------------
// POST /submit-bylaws-signature
//
// Records a digital signature for a club role. The client draws the
// signature with react-signature-canvas and sends the base64 PNG. This
// function:
//
//   1. Resolves the caller from the Bearer token.
//   2. Verifies the club role belongs to the caller and is active.
//   3. Captures the client IP (best-effort, from forwarded headers).
//   4. Computes a SHA-256 hash over the immutable fields
//      (user, club, role, bylaws version, signature image, IP, timestamp).
//   5. Stores the hash + timestamp on the role row.
//
// A role can only sign the CURRENT bylaws version: if the club bumps
// `bylaws_version`, the old hash is nullified (the re-sign flow triggers on
// next login because signature_hash becomes NULL).
//
// Issue: #3188

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { z } from "https://esm.sh/zod@3.24.2";
import { corsHeaders, parseJsonBody } from "../_shared/validation.ts";

const signatureSchema = z
  .object({
    club_id: z.string().uuid(),
    role_id: z.string().uuid(),
    bylaws_version: z.number().int().positive(),
    signature_base64: z.string().min(1).max(2_000_000),
  })
  .strict();

/** Best-effort client IP extraction from common proxy headers. */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return req.headers.get("cf-connecting-ip")?.trim() ?? "unknown";
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client bypasses RLS, so identity checks are manual below.
    // The membership query is scoped to the caller's user id, and the role is
    // only updated when that membership is active (status = approved).
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = await parseJsonBody(signatureSchema, req);
    if (!parsed.ok) return parsed.response;
    const { club_id, role_id, bylaws_version, signature_base64 } = parsed.data;

    // 1. Fetch the club + role, verifying the role belongs to the caller.
    const { data: membership, error: memError } = await supabase
      .from("club_members")
      .select(
        `
        club_id,
        user_id,
        status,
        club_roles (
          id,
          title,
          permissions_level,
          signed_bylaws_at,
          signature_hash,
          bylaws_version_signed
        )
      `,
      )
      .eq("club_id", club_id)
      .eq("user_id", user.id)
      .eq("role_id", role_id)
      .single();

    if (memError || !membership) {
      return new Response(JSON.stringify({ error: "Membership not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role = Array.isArray(membership.club_roles)
      ? membership.club_roles[0]
      : membership.club_roles;

    if (!role) {
      return new Response(JSON.stringify({ error: "Role not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (membership.status !== "approved") {
      return new Response(JSON.stringify({ error: "Membership is not active" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify the signature is for the CURRENT bylaws version.
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("bylaws_version, constitution_url")
      .eq("id", club_id)
      .single();

    if (clubError || !club) {
      return new Response(JSON.stringify({ error: "Club not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentVersion = club.bylaws_version ?? 1;
    if (bylaws_version !== currentVersion) {
      return new Response(
        JSON.stringify({
          error: "Bylaws version mismatch",
          current_bylaws_version: currentVersion,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Build the legally-binding hash.
    const ip = clientIp(req);
    const signedAt = new Date().toISOString();
    const hashInput = [
      user.id,
      club_id,
      role_id,
      String(currentVersion),
      signature_base64,
      ip,
      signedAt,
    ].join("|");
    const signatureHash = await sha256Hex(hashInput);

    // 4. Persist the signature (transactional via a single update).
    const { data: updateData, error: updateError } = await supabase
      .from("club_roles")
      .update({
        signed_bylaws_at: signedAt,
        signature_hash: signatureHash,
        bylaws_version_signed: currentVersion,
        signed_ip: ip,
      })
      .eq("id", role_id)
      .eq("club_id", club_id)
      .select("id");

    if (updateError) {
      console.error("[submit-bylaws-signature] Update error:", updateError.message);
      return new Response(JSON.stringify({ error: "Failed to save signature" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!updateData || updateData.length === 0) {
      return new Response(JSON.stringify({ error: "Role not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        signed_bylaws_at: signedAt,
        signature_hash: signatureHash,
        bylaws_version: currentVersion,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[submit-bylaws-signature] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
