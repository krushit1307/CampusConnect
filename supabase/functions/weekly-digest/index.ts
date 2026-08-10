import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SubscriberEmail = {
  email: string;
  full_name: string;
};

type EventItem = {
  id: string;
  title: string;
  event_date: string;
  location?: string | null;
  clubs?: { name: string } | { name: string }[] | null;
};

// HTML Escaper to prevent XSS in email client
function escapeHtml(unsafe: string): string {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Date Formatter
function formatDigestDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

// Dynamically compile HTML Email Template for Upcoming Events
function compileDigestHtml(events: EventItem[], appUrl: string): string {
  const safeAppUrl = escapeHtml(appUrl);

  const eventItemsHtml = events
    .map((event) => {
      const clubName = event.clubs
        ? Array.isArray(event.clubs)
          ? event.clubs[0]?.name
          : event.clubs.name
        : "Campus Club";
      const formattedDate = formatDigestDate(event.event_date);
      const safeTitle = escapeHtml(event.title);
      const safeClub = escapeHtml(clubName || "Campus Club");
      const safeLocation = escapeHtml(event.location || "TBA");
      const eventUrl = `${safeAppUrl}/events/${escapeHtml(event.id)}`;

      return `
        <div style="margin-bottom: 20px; padding: 16px; border: 2px solid #000000; background-color: #f7f7f5;">
          <div style="font-size: 11px; font-weight: 800; font-family: monospace; text-transform: uppercase; color: #4b5563; margin-bottom: 4px;">
            ${safeClub} &bull; ${formattedDate}
          </div>
          <div style="font-size: 18px; font-weight: 900; margin-bottom: 8px;">
            ${safeTitle}
          </div>
          <div style="font-size: 13px; font-family: monospace; color: #374151; margin-bottom: 12px;">
            📍 Location: ${safeLocation}
          </div>
          <a href="${eventUrl}" target="_blank" style="display: inline-block; background-color: #a3e635; color: #000000; font-weight: 800; font-family: monospace; text-transform: uppercase; text-decoration: none; padding: 8px 16px; border: 2px solid #000000; font-size: 12px;">
            View Event Details &rarr;
          </a>
        </div>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CampusConnect Weekly Digest - Upcoming Events</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f5; color: #000000; margin: 0; padding: 0;">
  <div style="max-width: 580px; margin: 32px auto; background-color: #ffffff; border: 3px solid #000000; box-shadow: 6px 6px 0px #000000; padding: 28px;">
    <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px solid #000000;">
      CAMPUS<span style="background-color: #000000; color: #ffffff; padding: 2px 8px;">CONNECT</span>
      <div style="font-size: 12px; font-family: monospace; font-weight: 700; color: #4b5563; margin-top: 4px; text-transform: uppercase;">
        📅 Upcoming Events Digest (Next 7 Days)
      </div>
    </div>
    <div style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
      <p>Hey there! Here are the exciting events happening across campus over the next 7 days:</p>
      ${eventItemsHtml}
    </div>
    <div style="text-align: center; margin: 28px 0 16px 0;">
      <a href="${safeAppUrl}/events" target="_blank" style="display: inline-block; background-color: #000000; color: #ffffff; font-weight: 800; font-family: monospace; text-transform: uppercase; text-decoration: none; padding: 12px 24px; border: 2px solid #000000; font-size: 13px;">
        Explore All Events on CampusConnect &rarr;
      </a>
    </div>
    <div style="margin-top: 32px; font-size: 11px; font-family: monospace; color: #6b7280; border-top: 2px solid #e5e7eb; padding-top: 16px;">
      <p>You received this email because you opted into the weekly CampusConnect newsletter digest.</p>
      <p>To update your email notification preferences, visit <a href="${safeAppUrl}/settings" style="color: #2563eb;">your account settings</a>.</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify Authorization (Require Service Role Key for Cron/Admin invocation)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const appUrl = Deno.env.get("APP_URL") || "https://campusconnect.app";

    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid service token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Query events happening in the NEXT 7 days (Acceptance Criteria 1)
    const now = new Date();
    const next7Days = new Date();
    next7Days.setDate(now.getDate() + 7);

    const nowStr = now.toISOString();
    const next7DaysStr = next7Days.toISOString();

    const { data: upcomingEvents, error: eventsError } = await supabase
      .from("events")
      .select("id, title, event_date, location, clubs(name)")
      .gte("event_date", nowStr)
      .lte("event_date", next7DaysStr)
      .is("deleted_at", null)
      .order("event_date", { ascending: true });

    if (eventsError) throw new Error(`Failed to fetch upcoming events: ${eventsError.message}`);

    if (!upcomingEvents || upcomingEvents.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming events in the next 7 days. Skipping newsletter digest." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Fetch Subscribers opted into newsletter_opt_in (Acceptance Criteria 3)
    const { data: subscribers, error: subError } = await supabase.rpc("get_digest_subscribers");

    if (subError) throw new Error(`Failed to fetch newsletter subscribers: ${subError.message}`);

    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers opted into newsletter digest." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailList = (subscribers as SubscriberEmail[])
      .map((sub) => sub.email)
      .filter((email): email is string => Boolean(email && email.includes("@")));

    if (emailList.length === 0) {
      return new Response(JSON.stringify({ message: "Subscriber list empty after validation." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Dynamically compile HTML Email Template (Acceptance Criteria 2)
    const htmlContent = compileDigestHtml(upcomingEvents as EventItem[], appUrl);

    // 5. Dispatch Emails (Resend or Mock Mode)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const emailBody = {
      from: "CampusConnect Digest <notifications@campusconnect.app>",
      to: ["notifications@campusconnect.app"], // Dummy header to address
      bcc: emailList,
      subject: `CampusConnect Digest: ${upcomingEvents.length} Upcoming Events This Week!`,
      html: htmlContent,
    };

    if (!resendApiKey) {
      if (Deno.env.get("MOCK_EMAIL") === "true" || Deno.env.get("DENO_ENV") === "test") {
        console.log(`[weekly-digest] Mock Mode: Simulated dispatch to ${emailList.length} newsletter subscribers.`);
        return new Response(
          JSON.stringify({
            message: "Mock newsletter digest sent successfully.",
            events_count: upcomingEvents.length,
            subscribers_count: emailList.length,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw new Error("Missing RESEND_API_KEY environment variable.");
    }

    // Batch send in chunks of 50
    const chunkSize = 50;
    const results = [];
    const failedChunks = [];

    for (let i = 0; i < emailList.length; i += chunkSize) {
      const chunk = emailList.slice(i, i + chunkSize);
      const idempotencyKey = `digest-${nowStr.substring(0, 10)}-chunk-${Math.floor(i / chunkSize)}`;
      const chunkBody = { ...emailBody, bcc: chunk };

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(chunkBody),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(`Resend API Error for chunk ${i}:`, resData);
        failedChunks.push({ chunkIndex: i, error: resData });
      } else {
        results.push(resData);
      }
    }

    if (failedChunks.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Failed to dispatch one or more digest chunks",
          failedChunks,
          chunks_sent: results.length,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        message: "Newsletter digest dispatched successfully",
        events_count: upcomingEvents.length,
        chunks_sent: results.length,
        total_subscribers: emailList.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("weekly-digest function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
