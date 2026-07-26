import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { UAParser } from "https://esm.sh/ua-parser-js@1.0.38";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get JWT from authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get User-Agent and parse browser + OS
    const userAgent = req.headers.get("user-agent") || "";
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser().name || "Unknown Browser";
    const os = parser.getOS().name || "Unknown OS";

    // Hash the OS and Browser to create a simple fingerprint
    const dataText = `${os}:${browser}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(dataText));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Fetch existing device fingerprints for this user
    const { data: existingDevices, error: fetchError } = await supabase
      .from("user_devices")
      .select("id, fingerprint")
      .eq("user_id", user.id);

    if (fetchError) {
      throw fetchError;
    }

    const hasDevices = existingDevices && existingDevices.length > 0;
    const isKnownDevice = existingDevices && existingDevices.some((d) => d.fingerprint === fingerprint);

    if (!isKnownDevice) {
      // Register this new device
      const { error: insertError } = await supabase
        .from("user_devices")
        .insert({
          user_id: user.id,
          fingerprint,
          browser,
          os,
          last_login_at: new Date().toISOString(),
        });

      if (insertError) {
        throw insertError;
      }

      // If the user already had other registered devices, this is a suspicious unrecognized login!
      if (hasDevices) {
        const email = user.email || "";
        const emailBody = {
          from: "CampusConnect <security@campusconnect.app>",
          to: [email],
          subject: "Security Alert: New Login from Unrecognized Device 🚨",
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
                  .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-top: 4px solid #ef4444; }
                  .header { text-align: center; padding-bottom: 20px; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
                  .title { font-size: 22px; font-weight: bold; color: #ef4444; }
                  .content { font-size: 16px; }
                  .details { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; }
                  .details p { margin: 6px 0; font-family: monospace; }
                  .btn-container { text-align: center; margin: 28px 0; }
                  .btn { display: inline-block; background-color: #ef4444; color: #ffffff !important; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; }
                  .footer { margin-top: 32px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <span class="title">Security Alert: Unrecognized Device Login</span>
                  </div>
                  <div class="content">
                    <p>Hello,</p>
                    <p>We detected a new login to your <strong>CampusConnect</strong> account from a device we don't recognize:</p>
                    <div class="details">
                      <p><strong>Browser:</strong> ${browser}</p>
                      <p><strong>Operating System:</strong> ${os}</p>
                      <p><strong>Time:</strong> ${new Date().toUTCString()}</p>
                    </div>
                    <p>If this was you, you can safely ignore this email. A new device fingerprint has been added to your account.</p>
                    <p><strong>If this wasn't you</strong>, please secure your account immediately by resetting your password:</p>
                    <div class="btn-container">
                      <a href="https://campusconnect.app/forgot-password" class="btn">Reset Password</a>
                    </div>
                  </div>
                  <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} CampusConnect. All rights reserved.</p>
                  </div>
                </div>
              </body>
            </html>
          `,
        };

        if (resendApiKey) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(emailBody),
          });
          if (!res.ok) {
            console.error("Resend API failed:", await res.text());
          }
        } else {
          console.log(`[Security Alert Mock] Sent email alert to ${email} for new device: ${browser} on ${os}`);
        }

        return new Response(JSON.stringify({ isNewDevice: true, browser, os }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Update last login timestamp for the known device
      await supabase
        .from("user_devices")
        .update({ last_login_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("fingerprint", fingerprint);
    }

    return new Response(JSON.stringify({ isNewDevice: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Device fingerprinting error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
