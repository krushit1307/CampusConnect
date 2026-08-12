import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const limited = await rateLimiter(req, "send-newsletter", 10, 60);
  if (limited) return limited;

  try {
    const { clubId, templateId, targetAudience } = await req.json().catch(() => ({}));

    if (!clubId) {
      return new Response(JSON.stringify({ error: "clubId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase Client with service role key to insert into bulk_email_jobs
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authorization (valid login session)
    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify that the user is an approved admin or organizer of the club
    const { data: member, error: memberError } = await supabase
      .from("club_members")
      .select("role")
      .eq("club_id", clubId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .single();

    if (memberError || !member || (member.role !== "admin" && member.role !== "organizer")) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only club admins or organizers can send newsletters" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Insert a pending job into the bulk_email_jobs table
    const { data: job, error: jobError } = await supabase
      .from("bulk_email_jobs")
      .insert({
        club_id: clubId,
        template_id: templateId || null,
        status: "pending",
        target_audience: targetAudience || "all",
      })
      .select("id")
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to queue email job: ${jobError?.message}`);
    }

    // Asynchronously trigger the worker to process the queue without blocking this request
    const workerUrl = `${supabaseUrl}/functions/v1/newsletter-worker`;
    fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    }).catch((err) => console.error("Failed to asynchronously trigger newsletter-worker:", err));

    return new Response(
      JSON.stringify({
        message: "Newsletter sending initiated in background",
        jobId: job.id,
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("send-newsletter function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
