import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { limitRate } from "../shared/rate_limiter.ts";
import { outboundCommunicationLimiter } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate Limiting: 5 requests per minute per IP
  const rateLimitResponse = await limitRate(req, "request-password-reset", {
    limit: 5,
    windowMs: 60000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { email, redirectTo } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 3. Database-level 15-minute global cooldown check per email
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentRequests, error: dbQueryError } = await supabaseAdmin
      .from("password_reset_requests")
      .select("requested_at")
      .eq("email", email)
      .gt("requested_at", fifteenMinutesAgo)
      .order("requested_at", { ascending: false })
      .limit(1);

    if (dbQueryError) {
      console.error("[request-password-reset] Database query error:", dbQueryError);
    }

    // If a request was sent in the last 15 minutes, silently return 200 OK
    // without triggering any token generation or email dispatch.
    if (recentRequests && recentRequests.length > 0) {
      console.log(
        `[request-password-reset] Cooldown active for ${email}. Silently returning 200 OK.`,
      );
      return new Response(
        JSON.stringify({ message: "If this email exists, a reset link has been sent." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Trigger recovery email using Supabase Auth (Anon client for safety)
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { error: resetError } = await supabaseAnon.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      console.error("[request-password-reset] Supabase reset error:", resetError);
    }

    // 3. Record this request regardless of outcome, so throttling works even
    // for emails that don't have an account.
    const { error: insertError } = await supabaseAdmin
      .from("password_reset_requests")
      .insert({ email });

    if (insertError) {
      console.error("[request-password-reset] Failed to record reset request:", insertError);
    }

    // Always respond with success so we don't leak which emails have accounts.
    return new Response(
      JSON.stringify({
        success: true,
        message: "If this email exists, a reset link has been sent.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[request-password-reset] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
