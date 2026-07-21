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

  // Rate Limiting: 5 requests per minute per IP
  const rateLimitResponse = await limitRate(req, "request-password-reset", {
    limit: 5,
    windowMs: 60000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count, error: countError } = await supabase
      .from("password_reset_requests")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("email", email)
      .gte("requested_at", oneHourAgo);

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) >= 3) {
      return new Response(
        JSON.stringify({
          error: "Too many password reset requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    console.error(error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
