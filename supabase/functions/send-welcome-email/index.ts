import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to escape HTML characters to prevent XSS in email rendering
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Extract details from direct payload or database webhook structure
    const record = body?.record || body;
    let userId = record?.id || body?.user_id;
    let email = record?.email || body?.email;
    let fullName =
      record?.full_name ||
      record?.raw_user_meta_data?.full_name ||
      body?.full_name ||
      "CampusConnect Member";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // If email is missing but userId is present, look up the email from auth.users or profiles
    if (!email && userId && supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        email = userData.user.email;
        if (!fullName || fullName === "CampusConnect Member") {
          fullName =
            userData.user.user_metadata?.full_name ||
            userData.user.email.split("@")[0] ||
            "CampusConnect Member";
        }
      }
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: email or valid user_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const safeName = escapeHtml(fullName);

    const emailBody = {
      from: "CampusConnect <welcome@campusconnect.app>",
      to: [email],
      subject: `Welcome to CampusConnect, ${fullName}! 🚀`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
              .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
              .logo { font-size: 24px; font-weight: bold; color: #4f46e5; text-decoration: none; }
              .content { font-size: 16px; }
              .features { background-color: #f1f5f9; border-radius: 8px; padding: 16px 20px; margin: 20px 0; list-style: none; }
              .features li { margin-bottom: 10px; }
              .btn-container { text-align: center; margin: 28px 0; }
              .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; }
              .footer { margin-top: 32px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <span class="logo">🚀 CampusConnect</span>
              </div>
              <div class="content">
                <h2>Welcome to the community, ${safeName}! 🎉</h2>
                <p>We are super excited to have you join <strong>CampusConnect</strong> — your central hub for campus life, clubs, and events.</p>
                <p>Here is what you can get started with right away:</p>
                <ul class="features">
                  <li>🔍 <strong>Explore Clubs:</strong> Join student organizations and stay updated with their activities.</li>
                  <li>📅 <strong>RSVP for Events:</strong> Discover campus events, workshops, and hackathons.</li>
                  <li>🤝 <strong>Network & Team Up:</strong> Connect with peers based on shared skills and interests.</li>
                </ul>
                <div class="btn-container">
                  <a href="https://campusconnect.app/dashboard" class="btn">Go to Dashboard</a>
                </div>
                <p>If you have any questions or feedback, simply reply to this email. We're here to help!</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} CampusConnect. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.log(`[Mock Mode] Welcome email dispatch mocked for recipient: ${email}`);
      return new Response(
        JSON.stringify({
          message: "Mock welcome email sent successfully.",
          recipient: email,
          fullName,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

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
      throw new Error(`Resend API Error (${res.status}): ${JSON.stringify(resData)}`);
    }

    return new Response(
      JSON.stringify({
        message: "Welcome email dispatched successfully.",
        data: resData,
        recipient: email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("send-welcome-email error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
