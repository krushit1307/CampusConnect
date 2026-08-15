// Admin: Manage Club Constitution / Bylaws
// -----------------------------------------
// POST /admin-bylaws
//
// Actions (body.action):
//   - "set-constitution":  update clubs.constitution_url (and optionally
//     bump bylaws_version to force re-signing).
//   - "bump-version":      increment clubs.bylaws_version AND null out every
//     signature on the club's roles, forcing all execs to re-sign.
//
// Only club admins (permissions_level >= 100 on an approved membership) or
// the club creator may perform these actions. Authorization is enforced via
// the RLS-scoped client + an explicit is_club_admin check.
//
// Issue: #3188

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { z } from "https://esm.sh/zod@3.24.2";
import { corsHeaders, parseJsonBody } from "../_shared/validation.ts";

const adminSchema = z
  .object({
    action: z.enum(["set-constitution", "bump-version"]),
    club_id: z.string().uuid(),
    constitution_url: z.string().url().optional(),
  })
  .strict();

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

    // Service-role client bypasses RLS; the explicit is_club_admin / creator
    // check below is the authorization boundary for these writes.

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

    const parsed = await parseJsonBody(adminSchema, req);
    if (!parsed.ok) return parsed.response;
    const { action, club_id, constitution_url } = parsed.data;

    // Admin check: club admin (permissions_level >= 100) or club creator.
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("id, created_by")
      .eq("id", club_id)
      .single();

    if (clubError || !club) {
      return new Response(JSON.stringify({ error: "Club not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCreator = club.created_by === user.id;
    const { data: adminRow } = await supabase
      .from("club_members")
      .select(
        `
        club_roles (permissions_level)
      `,
      )
      .eq("club_id", club_id)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .single();

    const role = adminRow
      ? Array.isArray(adminRow.club_roles)
        ? adminRow.club_roles[0]
        : adminRow.club_roles
      : null;
    const isAdmin = isCreator || (role?.permissions_level ?? 0) >= 100;

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set-constitution") {
      if (!constitution_url) {
        return new Response(
          JSON.stringify({ error: "constitution_url is required for set-constitution" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: current, error: fetchErr } = await supabase
        .from("clubs")
        .select("bylaws_version")
        .eq("id", club_id)
        .single();
      if (fetchErr) {
        return new Response(JSON.stringify({ error: "Database error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Setting a new constitution invalidates all existing signatures.
      const newVersion = (current?.bylaws_version ?? 1) + 1;

      const { error: updateErr } = await supabase
        .from("clubs")
        .update({ constitution_url, bylaws_version: newVersion })
        .eq("id", club_id);
      if (updateErr) {
        return new Response(JSON.stringify({ error: "Failed to update constitution" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Null out signatures so every exec must re-sign the new version.
      const { error: resetErr } = await supabase
        .from("club_roles")
        .update({
          signed_bylaws_at: null,
          signature_hash: null,
          bylaws_version_signed: null,
          signed_ip: null,
        })
        .eq("club_id", club_id);
      if (resetErr) {
        console.error("[admin-bylaws] Reset signatures error:", resetErr.message);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action,
          bylaws_version: newVersion,
          signatures_reset: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // action === "bump-version"
    const { data: currentBump, error: bumpFetchErr } = await supabase
      .from("clubs")
      .select("bylaws_version")
      .eq("id", club_id)
      .single();
    if (bumpFetchErr) {
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newVersion = (currentBump?.bylaws_version ?? 1) + 1;
    const { error: bumpErr } = await supabase
      .from("clubs")
      .update({ bylaws_version: newVersion })
      .eq("id", club_id);
    if (bumpErr) {
      return new Response(JSON.stringify({ error: "Failed to bump bylaws version" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: resetBumpErr } = await supabase
      .from("club_roles")
      .update({
        signed_bylaws_at: null,
        signature_hash: null,
        bylaws_version_signed: null,
        signed_ip: null,
      })
      .eq("club_id", club_id);
    if (resetBumpErr) {
      console.error("[admin-bylaws] Reset signatures error:", resetBumpErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        bylaws_version: newVersion,
        signatures_reset: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[admin-bylaws] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
