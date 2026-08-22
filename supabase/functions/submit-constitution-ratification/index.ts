import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { z } from "https://esm.sh/zod@3.24.2";
import { corsHeaders, parseJsonBody } from "../_shared/validation.ts";

const ratificationSchema = z
  .object({
    club_id: z.string().uuid(),
    constitution_version: z.number().int().positive(),
    legal_name: z.string().trim().min(2).max(200),
  })
  .strict();

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip")?.trim() || req.headers.get("cf-connecting-ip")?.trim() || "unknown"
  );
}

function normalizeLegalName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isFullLegalName(value: string): boolean {
  const normalized = normalizeLegalName(value);
  return normalized.length >= 2 && normalized.split(" ").filter(Boolean).length >= 2;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const parsed = await parseJsonBody(ratificationSchema, req);
    if (!parsed.ok) return parsed.response;

    const { club_id, constitution_version, legal_name: submittedName } = parsed.data;
    const legalName = normalizeLegalName(submittedName);
    if (!isFullLegalName(legalName)) {
      return new Response(JSON.stringify({ error: "Enter your full legal name." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("club_members")
      .select("club_id, user_id, status, constitution_ratification_required")
      .eq("club_id", club_id)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .single();

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: "Active club membership not found." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("id, bylaws_version")
      .eq("id", club_id)
      .single();

    if (clubError || !club) {
      return new Response(JSON.stringify({ error: "Club not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentVersion = club.bylaws_version ?? 1;
    if (constitution_version !== currentVersion) {
      return new Response(
        JSON.stringify({
          error: "The constitution changed while you were reviewing it. Please reload.",
          current_version: currentVersion,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ipAddress = clientIp(req);
    const signedAt = new Date().toISOString();
    const signatureHash = await sha256Hex(
      [user.id, club_id, String(currentVersion), legalName, signedAt, ipAddress].join("|"),
    );

    const { error: insertError } = await supabase.from("constitution_signatures").insert({
      club_id,
      user_id: user.id,
      constitution_version: currentVersion,
      legal_name: legalName,
      signed_at: signedAt,
      ip_address: ipAddress,
      signature_hash: signatureHash,
    });

    if (insertError && insertError.code !== "23505") {
      console.error("[submit-constitution-ratification] Insert error:", insertError.message);
      return new Response(JSON.stringify({ error: "Failed to save ratification." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: clearError } = await supabase
      .from("club_members")
      .update({ constitution_ratification_required: false })
      .eq("club_id", club_id)
      .eq("user_id", user.id)
      .eq("status", "approved");

    if (clearError) {
      console.error(
        "[submit-constitution-ratification] Membership update error:",
        clearError.message,
      );
      return new Response(JSON.stringify({ error: "Failed to activate club membership." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        club_id,
        constitution_version: currentVersion,
        signed_at: signedAt,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[submit-constitution-ratification] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
