import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { limitRate } from "../shared/rate_limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate Limiting: 5 requests per hour per IP
  const ipRateLimitResponse = await limitRate(req, "request-password-reset-ip", { limit: 5, windowMs: 3600000 });
  if (ipRateLimitResponse) {
    return ipRateLimitResponse;
  }

  try {
    // Read request body
    const { email, redirectTo } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Rate Limiting: 3 requests per hour per email
    const emailRateLimitResponse = await limitRate(req, "request-password-reset-email", { limit: 3, windowMs: 3600000, identifier: email });
    if (emailRateLimitResponse) {
      return emailRateLimitResponse;
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    if (linkError) {
      throw linkError;
    }

    const recoveryLink = data.properties.actionLink;
    const emailBody = {
      from: "CampusConnect <notifications@campusconnect.app>",
      to: [email],
      subject: "Reset your CampusConnect password",
      html: `
    <h2>Reset your password</h2>

    <p>We received a request to reset your password.</p>

    <p>
      <a href="${recoveryLink}">
        Reset Password
      </a>
    </p>

    <p>If you didn't request this, you can safely ignore this email.</p>
  `,
    };
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.log("Mocking password reset email for:", email);
    } else {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(emailBody),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(`Resend Error: ${JSON.stringify(resData)}`);
      }
    }

    await supabase.from("password_reset_requests").insert({
      email,
    });

  } catch (error: unknown) {
    console.error("Password reset error:", error);
    // Suppress error to avoid email enumeration and keep response timing consistent
  }

  // Always return the same success message regardless of outcome
  return new Response(JSON.stringify({ message: "If this email exists, a reset link has been sent." }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
});

