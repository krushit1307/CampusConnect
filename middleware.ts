// =============================================================================
// Vercel Edge Middleware: Bot Interception for Open Graph Unfurling
// Issue: #3176 - Build a 'Cross-Platform Event Sharing Card' (Open Graph)
// Description: CampusConnect is a client-rendered Vite SPA, so link-preview
// bots (iMessage, WhatsApp, Discord, Slack, Twitter, Facebook) never execute
// the JavaScript that would normally fetch event data. This middleware runs
// at the Edge, detects known bot user-agents requesting an /events/:eventId
// page, and proxies the request to the `event-share` Supabase Edge Function,
// which returns pre-rendered HTML with the correct og:/twitter: meta tags.
// Regular browser requests are passed straight through to the SPA.
// =============================================================================

export const config = {
  matcher: "/events/:path*",
};

const BOT_USER_AGENT_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|Discordbot|Slackbot|TelegramBot|LinkedInBot|WhatsApp|SkypeUriPreview|Applebot|Googlebot|Pinterest|redditbot|iMessage/i;

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean); // e.g. ["events", "spring-mixer-2026"]

  // Only intercept the event detail page itself (/events/:eventId),
  // never sub-routes like /events/:eventId/dashboard or /events/map.
  const isEventDetailPage = segments.length === 2 && segments[0] === "events" && segments[1] !== "map";
  const userAgent = request.headers.get("user-agent") || "";

  if (!isEventDetailPage || !BOT_USER_AGENT_PATTERN.test(userAgent)) {
    return fetch(request);
  }

  const eventId = segments[1];
  const supabaseUrl = process.env.VITE_SUPABASE_URL;

  if (!supabaseUrl) {
    return fetch(request);
  }

  const shareUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/event-share?event=${encodeURIComponent(eventId)}`;

  try {
    const shareResponse = await fetch(shareUrl);
    if (!shareResponse.ok) {
      return fetch(request);
    }

    const html = await shareResponse.text();
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    // If the share function is unreachable, fall back to the SPA rather
    // than breaking the link entirely.
    return fetch(request);
  }
}