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

    const { data: rows, error } = await supabase
      .from("club_members")
      .select(
        `
        club_id,
        constitution_ratification_required,
        clubs (
          name,
          slug,
          constitution_url,
          bylaws_version
        )
      `,
      )
      .eq("user_id", user.id)
      .eq("status", "approved")
      .eq("constitution_ratification_required", true);

    if (error) {
      console.error("[constitution-ratification-status] Query error:", error.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const outstanding = (rows ?? [])
      .map((row) => {
        const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;
        if (!club) return null;
        return {
          club_id: row.club_id,
          club_name: club.name,
          club_slug: club.slug,
          constitution_url: club.constitution_url ?? null,
          constitution_version: club.bylaws_version ?? 1,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return new Response(
      JSON.stringify({
        success: true,
        needs_ratification: outstanding.length > 0,
        outstanding,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[constitution-ratification-status] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
