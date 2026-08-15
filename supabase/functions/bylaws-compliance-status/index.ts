// Bylaws Compliance Status
// -------------------------
// GET /bylaws-compliance-status
//
// Returns, for the authenticated user, every club where they hold an active
// (approved) executive role that has NOT signed the club's current bylaws
// version, along with the club's constitution URL and current bylaws version.
//
// The frontend ComplianceCheckGuard uses this to redirect execs with an
// outstanding signature to the mandatory /compliance-check page.
//
// Issue: #3188

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { corsHeaders } from "../_shared/validation.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Resolve the caller from the Authorization header (RLS will then scope
    // every query to this user).
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

    // Active memberships where the linked role has not signed the current
    // bylaws version (signature_hash IS NULL OR signed an older version).
    const { data: rows, error } = await supabase
      .from("club_members")
      .select(
        `
        club_id,
        clubs (
          name,
          slug,
          logo_url,
          constitution_url,
          bylaws_version
        ),
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
      .eq("user_id", user.id)
      .eq("status", "approved");

    if (error) {
      console.error("[bylaws-compliance-status] Query error:", error.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const outstanding = (rows ?? [])
      .map((row) => {
        const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;
        const role = Array.isArray(row.club_roles) ? row.club_roles[0] : row.club_roles;
        if (!club || !role) return null;
        const currentVersion = club.bylaws_version ?? 1;
        const isSigned =
          role.signature_hash !== null &&
          role.signature_hash !== undefined &&
          (role.bylaws_version_signed ?? 0) >= currentVersion;
        return {
          club_id: row.club_id,
          club_name: club.name,
          club_slug: club.slug,
          club_logo_url: club.logo_url ?? null,
          constitution_url: club.constitution_url ?? null,
          bylaws_version: currentVersion,
          role_id: role.id,
          role_title: role.title,
          permissions_level: role.permissions_level,
          signed: isSigned,
          signed_bylaws_at: role.signed_bylaws_at ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const needsCompliance = outstanding.filter((item) => !item.signed);

    return new Response(
      JSON.stringify({
        success: true,
        needs_compliance: needsCompliance.length > 0,
        outstanding,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[bylaws-compliance-status] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
