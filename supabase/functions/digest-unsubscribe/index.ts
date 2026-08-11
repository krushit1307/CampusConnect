import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function htmlPage(status: number, heading: string, message: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading} - CampusConnect</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f5; color: #000000; margin: 0; padding: 0;">
  <div style="max-width: 460px; margin: 64px auto; background-color: #ffffff; border: 3px solid #000000; box-shadow: 6px 6px 0px #000000; padding: 28px;">
    <div style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 3px solid #000000;">
      CAMPUS<span style="background-color: #000000; color: #ffffff; padding: 2px 8px;">CONNECT</span>
    </div>
    <h1 style="font-size: 18px; font-weight: 900; margin: 0 0 12px 0;">${heading}</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">${message}</p>
  </div>
</body>
</html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        ...corsHeaders,
      },
    },
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  const token = url.searchParams.get("token") ?? "";

  if (!email || !token) {
    return htmlPage(
      400,
      "Invalid link",
      "This unsubscribe link is missing required information. Please use the link from your email.",
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseServiceKey) {
    return htmlPage(500, "Something went wrong", "Please try again later.");
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.rpc("set_marketing_opt_out", {
      p_email: email,
      p_token: token,
    });

    if (error || data !== true) {
      return htmlPage(
        400,
        "Invalid or expired link",
        "We could not process this unsubscribe request. The link may be invalid or already used. If you keep getting emails, visit your account settings.",
      );
    }

    return htmlPage(
      200,
      "You're unsubscribed",
      "You have been unsubscribed from the CampusConnect weekly digest. You will no longer receive digest emails to this address.",
    );
  } catch (err) {
    console.error("digest-unsubscribe error:", err);
    return htmlPage(500, "Something went wrong", "Please try again later.");
  }
});
