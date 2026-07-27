import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Login proxy with brute-force protection.
 *
 * Before forwarding credentials to Supabase Auth, this checks the
 * `login_attempts` table (via the `check_login_lockout` DB function) for
 * both the submitted email and the caller's IP address. If either has 5+
 * failed attempts in the last 15 minutes, the request is rejected with a
 * 429 instead of being forwarded. Every attempt (success or failure) is
 * recorded so future requests can be evaluated correctly.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const xForwardedFor = req.headers.get("x-forwarded-for");
    const ip = xForwardedFor ? xForwardedFor.split(",")[0].trim() : "127.0.0.1";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Check whether this email or IP is currently locked out.
    const { data: lockoutRows, error: lockoutError } = await supabaseAdmin.rpc(
      "check_login_lockout",
      { p_email: email, p_ip: ip },
    );

    if (lockoutError) {
      console.error("[login-proxy] Failed to check lockout status:", lockoutError);
    }

    const lockout = lockoutRows?.[0];
    if (lockout?.is_locked) {
      return new Response(
        JSON.stringify({
          error: "Too many failed login attempts. Please try again later.",
          retryAfter: lockout.retry_after_seconds,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(lockout.retry_after_seconds),
          },
        },
      );
    }

    // 2. Forward the credentials to Supabase Auth.
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    // 3. Record this attempt so future lockout checks see it.
    const { error: insertError } = await supabaseAdmin.from("login_attempts").insert({
      email,
      ip_address: ip,
      success: !signInError,
    });

    if (insertError) {
      console.error("[login-proxy] Failed to record login attempt:", insertError);
    }

    if (signInError) {
      return new Response(JSON.stringify({ error: signInError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Successful login: clear this email's failed-attempt history.
    const { error: clearError } = await supabaseAdmin.rpc("clear_login_attempts", {
      p_email: email,
    });

    if (clearError) {
      console.error("[login-proxy] Failed to clear login attempts:", clearError);
    }

    return new Response(JSON.stringify({ session: signInData.session, user: signInData.user }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[login-proxy] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
