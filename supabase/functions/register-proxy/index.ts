import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, password, captchaToken, ...userData } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!captchaToken) {
      return new Response(JSON.stringify({ error: "CAPTCHA verification is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify Turnstile CAPTCHA
    const isValidCaptcha = await verifyTurnstile(captchaToken);
    if (!isValidCaptcha) {
      return new Response(JSON.stringify({ error: "Invalid or expired CAPTCHA token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Attempt to register the user
    // We use admin.createUser to avoid auto-login sessions in the backend if we used signUp.
    // Wait, admin.createUser doesn't send email confirmation by default if confirm=true, but confirm=false sends it.
    const { data: userDataObj, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // forces confirmation email to be sent
      user_metadata: {
        ...userData,
      },
    });

    if (userError) {
      console.error("[register-proxy] Registration failed:", userError);
      return new Response(JSON.stringify({ error: userError.message || "Registration failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user: userDataObj.user }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("[register-proxy] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
