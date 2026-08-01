import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Throttles password reset emails to 1 per hour per email address.
 *
 * Checks the `password_reset_requests` table (via the
 * `check_password_reset_throttle` DB function) before asking Supabase Auth
 * to send a reset email. Always responds with `{ success: true }` so we
 * never reveal whether an email address has an account.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // 1. Check whether this email already requested a reset in the last hour.
    const { data: throttleRows, error: throttleError } = await supabaseAdmin.rpc(
      "check_password_reset_throttle",
      { p_email: email },
    );

    if (throttleError) {
      console.error("[request-password-reset] Failed to check throttle status:", throttleError);
    }

    const throttle = throttleRows?.[0];
    if (throttle?.is_throttled) {
      return new Response(
        JSON.stringify({
          error: "A reset link was already sent recently. Please check your inbox.",
          retryAfter: throttle.retry_after_seconds,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(throttle.retry_after_seconds),
          },
        },
      );
    }

    // 2. Ask Supabase Auth to send the reset email.
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
    // for emails that don't have an account (Supabase Auth silently no-ops
    // for those, but we still don't want it spammed).
    const { error: insertError } = await supabaseAdmin
      .from("password_reset_requests")
      .insert({ email });

    if (insertError) {
      console.error("[request-password-reset] Failed to record reset request:", insertError);
    }

    // Always respond with success so we don't leak which emails have accounts.
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[request-password-reset] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
