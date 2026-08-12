import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

interface EventRow {
  id: string;
  short_id: string | null;
  title: string;
  description: string | null;
  event_date: string | null;
  banner_url: string | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "text/html; charset=utf-8",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildOgImageUrl(eventId: string): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured");
  }

  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/og-image?event_id=${encodeURIComponent(eventId)}`;
}

function getSiteUrl(): string {
  return (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
}

function truncateDescription(value: string | null): string {
  if (!value) return "An event on CampusConnect.";

  const clean = value.replace(/<[^>]*>/g, "").trim();

  return clean.length > 200 ? `${clean.slice(0, 197)}...` : clean;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id");

  if (!eventId) {
    return new Response("Missing event_id", {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
    return new Response("Invalid event_id", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const { data: event, error } = await supabase
    .from("events")
    .select("id, short_id, title, description, event_date, banner_url")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !event) {
    return new Response("Event not found", {
      status: 404,
      headers: corsHeaders,
    });
  }

  const siteUrl = getSiteUrl();

  const eventPath = event.short_id
    ? `/events/${event.short_id}`
    : `/events/${event.id}`;

  const eventUrl = `${siteUrl}${eventPath}`;
  const ogImageUrl = buildOgImageUrl(event.id);

  const title = escapeHtml(`${event.title} | CampusConnect`);
  const description = escapeHtml(truncateDescription(event.description));

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">

  <title>${title}</title>

  <meta name="description" content="${description}">

  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${escapeHtml(eventUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">

  <meta http-equiv="refresh" content="0;url=${escapeHtml(eventUrl)}">
</head>

<body>
  <p>
    Redirecting to
    <a href="${escapeHtml(eventUrl)}">${escapeHtml(event.title)}</a>
  </p>

  <script>
    window.location.replace(${JSON.stringify(eventUrl)});
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});