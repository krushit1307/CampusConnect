import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const limited = await rateLimiter(req, "send-newsletter", 10, 60);
  if (limited) return limited;

  try {
    const { clubId, newsletterId, templateId } = await req.json().catch(() => ({}));

    if (!clubId) {
      return new Response(JSON.stringify({ error: "clubId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin/organizer status
    const { data: member, error: memberError } = await supabase
      .from("club_members")
      .select("role")
      .eq("club_id", clubId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle();

    const isClubAdmin =
      member && ["admin", "organizer", "president", "officer"].includes(member.role.toLowerCase());

    if (memberError || !isClubAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only club admins or organizers can send newsletters" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Trigger newsletter-worker in background
    const workerUrl = `${supabaseUrl}/functions/v1/newsletter-worker`;
    fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ newsletterId, clubId, templateId }),
    }).catch((err) => console.error("Failed to trigger newsletter-worker:", err));

    return new Response(
      JSON.stringify({
        message: "Newsletter dispatch initiated in background",
        newsletterId,
        clubId,
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("send-newsletter error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
