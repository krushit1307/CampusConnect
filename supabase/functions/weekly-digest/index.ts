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

serve(async (req) => {
  // Handle CORS
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

    // We enforce that the provided token matches the service role key or a custom cron secret
    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid service token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch Active Items from the past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    // Fetch new events
    const { data: newEvents, error: eventsError } = await supabase
      .from("events")
      .select("id, title, event_date, location, clubs(name)")
      .gte("created_at", sevenDaysAgoStr);

    if (eventsError) throw new Error(`Failed to fetch events: ${eventsError.message}`);

    // Fetch active discussion posts
    const { data: newPosts, error: postsError } = await supabase
      .from("posts")
      .select("id, content, created_at, clubs(name)")
      .gte("created_at", sevenDaysAgoStr)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (postsError) throw new Error(`Failed to fetch posts: ${postsError.message}`);

    if ((!newEvents || newEvents.length === 0) && (!newPosts || newPosts.length === 0)) {
      return new Response(
        JSON.stringify({ message: "No new activity in the past 7 days. Skipping digest." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Fetch Subscribers
    const { data: subscribers, error: subError } = await supabase.rpc("get_digest_subscribers");

    if (subError) throw new Error(`Failed to fetch subscribers: ${subError.message}`);

    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers opted into weekly digest." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailList = (subscribers as SubscriberEmail[]).map((sub) => sub.email);

    // Helper to escape HTML to prevent XSS
    const escapeHtml = (unsafe: string) => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    let htmlContent = `<h2>Your CampusConnect Weekly Digest</h2>`;
    htmlContent += `<p>Here's what you missed this week!</p>`;

    if (newEvents && newEvents.length > 0) {
      htmlContent += `<h3>🎉 New Events</h3><ul>`;
      for (const event of newEvents) {
        const clubName = event.clubs
          ? Array.isArray(event.clubs)
            ? event.clubs[0].name
            : event.clubs.name
          : "Unknown Club";
        htmlContent += `<li><strong>${escapeHtml(event.title)}</strong> by ${escapeHtml(clubName)} (Date: ${new Date(event.event_date).toLocaleString()})</li>`;
      }
      htmlContent += `</ul>`;
    }

    if (newPosts && newPosts.length > 0) {
      htmlContent += `<h3>💬 Active Discussions</h3><ul>`;
      // Show up to 5 latest posts to keep email concise
      const topPosts = newPosts.slice(0, 5);
      for (const post of topPosts) {
        const clubName = post.clubs
          ? Array.isArray(post.clubs)
            ? post.clubs[0].name
            : post.clubs.name
          : "Unknown Club";
        const preview =
          post.content.length > 50 ? post.content.substring(0, 50) + "..." : post.content;
        htmlContent += `<li><strong>${escapeHtml(clubName)}</strong>: "${escapeHtml(preview)}"</li>`;
      }
      if (newPosts.length > 5) {
        htmlContent += `<li><em>...and ${newPosts.length - 5} more posts!</em></li>`;
      }
      htmlContent += `</ul>`;
    }

    htmlContent += `<br/><p><a href="https://campusconnect.app">Log in to CampusConnect</a> to see more details.</p>`;

    // 5. Dispatch Emails via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const emailBody = {
      from: "CampusConnect Digest <notifications@campusconnect.app>",
      to: ["notifications@campusconnect.app"], // Dummy to address
      bcc: emailList,
      subject: `CampusConnect Weekly Digest: ${newEvents?.length || 0} Events, ${newPosts?.length || 0} Discussions`,
      html: htmlContent,
    };

    if (!resendApiKey) {
      // Missing API key is an error in production unless MOCK_EMAIL is explicitly set
      if (Deno.env.get("MOCK_EMAIL") === "true") {
        console.log("Mocking digest dispatch. Would have sent to:", emailList.length, "users.");
        return new Response(
          JSON.stringify({
            message: "Mock digest emails sent successfully.",
            count: emailList.length,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw new Error("Missing RESEND_API_KEY environment variable.");
    }

    // Send the email (assuming chunking isn't strictly necessary for < 50 users right now,
    // or Resend supports up to 50 bcc. If it exceeds 50, we should chunk it in production)
    const chunkSize = 50;
    const results = [];
    const failedChunks = [];

    for (let i = 0; i < emailList.length; i += chunkSize) {
      const chunk = emailList.slice(i, i + chunkSize);
      // Use Idempotency key per chunk and week to prevent duplicates
      const idempotencyKey = `digest-${sevenDaysAgoStr.substring(0, 10)}-chunk-${i / chunkSize}`;
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

      const resData = await res.json();
      if (!res.ok) {
        console.error(`Resend Error for chunk ${i}:`, resData);
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
        message: "Digest dispatched successfully",
        chunks_sent: results.length,
        total_users: emailList.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
