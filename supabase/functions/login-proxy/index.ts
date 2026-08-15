import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { loginLimiter } from "../_shared/rateLimiter.ts";
import { parseJsonBody } from "../_shared/validation.ts";

// Login requests either carry credentials or an account-unlock action.
// Each branch is validated strictly so stray fields are rejected.
const loginSchema = z
  .object({
    email: z.string().max(255, "email is too long").email("email must be a valid email address"),
    password: z.string().min(1, "password is required").max(256),
  })
  .strict();

const unlockSchema = z
  .object({
    action: z.literal("unlock"),
    email: z.string().max(255, "email is too long").email("email must be a valid email address"),
    token: z.string().min(1, "token is required"),
  })
  .strict();
const loginProxySchema = z.union([loginSchema, unlockSchema]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-test-ip, x-test-latitude, x-test-longitude, x-test-city, x-test-country",
};

/**
 * Login proxy with brute-force protection and impossible travel detector.
 *
 * Before forwarding credentials to Supabase Auth, this checks the
 * `login_attempts` table (via the `check_login_lockout` DB function) for
 * both the submitted email and the caller's IP address.
 * It also checks whether the profile is locked (`is_locked`).
 * On successful auth, it geolocates the client IP and checks for impossible
 * travel velocity (> 1000 km/h) compared to the previous login.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  const result = await loginLimiter.limit(ip);

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please try again later.",
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
        },
      },
    );
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const rawText = await req.text();
    const parsed = await parseJsonBody(
      loginProxySchema,
      new Request(req.url, {
        method: "POST",
        headers: req.headers,
        body: rawText.trim() ? rawText : null,
      }),
    );
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Handle account unlock action
    if ("action" in body && body.action === "unlock") {
      const { email, token } = body;
      if (!email || !token) {
        return new Response(JSON.stringify({ error: "Email and token are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userData, error: userFetchError } =
        await supabaseAdmin.auth.admin.getUserByEmail(email);
      if (userFetchError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Invalid email or token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = userData.user.id;
      const { data: profile, error: profileFetchError } = await supabaseAdmin
        .from("profiles")
        .select("unlock_token, is_locked")
        .eq("id", userId)
        .single();

      if (profileFetchError || !profile || !profile.is_locked || profile.unlock_token !== token) {
        return new Response(JSON.stringify({ error: "Invalid email or token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: unlockError } = await supabaseAdmin
        .from("profiles")
        .update({
          is_locked: false,
          unlock_token: null,
          locked_at: null,
        })
        .eq("id", userId);

      if (unlockError) {
        console.error("[login-proxy] Failed to unlock profile:", unlockError);
        return new Response(
          JSON.stringify({ error: "Failed to unlock account. Please try again." }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({ message: "Account unlocked successfully. You can now log in." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Standard Login flow
    const { email, password, captchaToken } = body as {
      email: string;
      password: string;
      captchaToken: string;
    };

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

    const isValidCaptcha = await verifyTurnstile(captchaToken);
    if (!isValidCaptcha) {
      return new Response(JSON.stringify({ error: "Invalid or expired CAPTCHA token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const xForwardedFor = req.headers.get("x-forwarded-for");
    const ip = xForwardedFor ? xForwardedFor.split(",")[0].trim() : "127.0.0.1";

    // 1. Check whether this email or IP is currently locked out (brute-force).
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

    // 1b. Check whether the account is locked due to impossible travel suspicious login.
    const { data: userData, error: userFetchError } =
      await supabaseAdmin.auth.admin.getUserByEmail(email);
    if (!userFetchError && userData?.user) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("is_locked")
        .eq("id", userData.user.id)
        .single();

      if (profile?.is_locked) {
        return new Response(
          JSON.stringify({
            error:
              "Your account is temporarily locked due to suspicious activity. Please check your email for an unlock link.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
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

    // 3. Record this attempt so future brute-force lockout checks see it.
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

    // 4. Successful login: clear brute-force lockout attempt history.
    const { error: clearError } = await supabaseAdmin.rpc("clear_login_attempts", {
      p_email: email,
    });

    if (clearError) {
      console.error("[login-proxy] Failed to clear login attempts:", clearError);
    }

    // 5. Run Impossible Travel Detection
    const userId = signInData.user.id;

    // Resolve IP geolocation (checking testing overrides first)
    let lat = 40.7128; // Default: New York
    let lon = -74.006;
    let city = "New York";
    let country = "United States";

    const testIp = req.headers.get("x-test-ip");
    const testLatStr = req.headers.get("x-test-latitude");
    const testLonStr = req.headers.get("x-test-longitude");
    const testCity = req.headers.get("x-test-city");
    const testCountry = req.headers.get("x-test-country");

    const activeIp = testIp || ip;

    if (testLatStr && testLonStr) {
      lat = parseFloat(testLatStr);
      lon = parseFloat(testLonStr);
      city = testCity || "Unknown";
      country = testCountry || "Unknown";
    } else if (
      activeIp &&
      activeIp !== "127.0.0.1" &&
      activeIp !== "::1" &&
      !activeIp.startsWith("192.168.") &&
      !activeIp.startsWith("10.") &&
      !activeIp.startsWith("172.16.")
    ) {
      try {
        const response = await fetch(`https://ipapi.co/${activeIp}/json/`);
        if (response.ok) {
          const geoData = await response.json();
          if (
            geoData &&
            typeof geoData.latitude === "number" &&
            typeof geoData.longitude === "number"
          ) {
            lat = geoData.latitude;
            lon = geoData.longitude;
            city = geoData.city || "Unknown";
            country = geoData.country_name || "Unknown";
          }
        }
      } catch (geoErr) {
        console.warn(`[login-proxy] Geocoding API lookup failed for IP ${activeIp}:`, geoErr);
      }
    }

    // Invoke database impossible travel verification function
    const { data: isImpossible, error: travelError } = await supabaseAdmin.rpc(
      "check_impossible_travel",
      {
        p_user_id: userId,
        p_lat: lat,
        p_lon: lon,
      },
    );

    if (travelError) {
      console.error("[login-proxy] check_impossible_travel RPC failed:", travelError);
    }

    if (isImpossible) {
      // Suspicious impossible travel login detected! Lock the profile immediately
      const unlockToken = crypto.randomUUID();

      await supabaseAdmin
        .from("profiles")
        .update({
          is_locked: true,
          unlock_token: unlockToken,
          locked_at: new Date().toISOString(),
        })
        .eq("id", userId);

      // Invalidate all active user sessions globally
      await supabaseAdmin.auth.admin.signOut(userId, "global");

      // Send the secure unlock email to the user
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const emailBody = {
        from: "CampusConnect <security@campusconnect.app>",
        to: [email],
        subject: "Security Alert: Suspicious Login Activity Detected 🚨",
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
                  <span class="title">Security Alert: Suspicious Login Blocked</span>
                </div>
                <div class="content">
                  <p>Hello,</p>
                  <p>We detected a login attempt for your account that indicates impossible travel velocity (e.g., logging in from two distant locations almost simultaneously).</p>
                  <p>For your security, we have temporarily locked your account and invalidated all active sessions.</p>
                  <p><strong>Login details:</strong></p>
                  <div class="details">
                    <p><strong>IP Address:</strong> ${activeIp}</p>
                    <p><strong>Location:</strong> ${city}, ${country}</p>
                    <p><strong>Time:</strong> ${new Date().toUTCString()}</p>
                  </div>
                  <p>If this was you (for example, if you are using a VPN or proxy), you can unlock your account using the link below:</p>
                  <div class="btn-container">
                    <a href="https://campusconnect.app/unlock?token=${unlockToken}&email=${encodeURIComponent(email)}" class="btn">Unlock Account</a>
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
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify(emailBody),
        }).catch((err) => console.error("[login-proxy] Failed to send Resend unlock email:", err));
      } else {
        console.log(
          `[Suspicious Login Alert Mock] Unlock token generated for ${email}: ${unlockToken}`,
        );
      }

      return new Response(
        JSON.stringify({
          error:
            "Your account is temporarily locked due to suspicious activity. Please check your email for an unlock link.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 6. Travel is possible: Record successful login in login_history
    const { error: insertHistoryError } = await supabaseAdmin.from("login_history").insert({
      user_id: userId,
      ip_address: activeIp,
      latitude: lat,
      longitude: lon,
      city,
      country,
    });

    if (insertHistoryError) {
      console.error("[login-proxy] Failed to record login history:", insertHistoryError);
    }

    const isProduction =
      Deno.env.get("ENVIRONMENT") === "production" || Deno.env.get("DENO_ENV") === "production";
    const cookieFlags = [
      `sb-access-token=${signInData.session?.access_token}; Path=/`,
      "HttpOnly",
      "SameSite=Strict",
      isProduction ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    return new Response(JSON.stringify({ session: signInData.session, user: signInData.user }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Set-Cookie": cookieFlags,
      },
    });
  } catch (err) {
    console.error("[login-proxy] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
