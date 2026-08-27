import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { rateLimiter } from "../shared/rateLimiter.ts";
import {
  DEFAULT_TOP_N,
  scoreAndSelectTopEvents,
  type DigestContext,
  type DigestEvent,
  type DigestUser,
  type ScoredEvent,
} from "./scoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RSVP statuses that count as "already attending" (excluded from recommendations).
// Whitelist instead of blacklist: only these statuses remove an event, so future
// status values (e.g. cancelled) never silently drop events from the digest.
const ATTENDING_RSVP_STATUSES = new Set(["approved", "waitlisted"]);

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

// Dynamically compile a personalized HTML Email Template for the user's top picks
function compileDigestHtml(
  user: DigestUser,
  events: ScoredEvent[],
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const safeAppUrl = escapeHtml(appUrl);
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);
  const safeName = escapeHtml(user.full_name || "there");

  const eventItemsHtml = events
    .map((event) => {
      const clubName = event.club_name || "Campus Club";
      const formattedDate = formatDigestDate(event.event_date);
      const safeTitle = escapeHtml(event.title);
      const safeClub = escapeHtml(clubName);
      const safeLocation = escapeHtml(event.location || "TBA");
      const eventUrl = `${safeAppUrl}/events/${escapeHtml(event.id)}`;
      const reasonsHtml =
        event.reasons.length > 0
          ? `
          <div style="font-size: 11px; font-weight: 700; font-family: monospace; text-transform: uppercase; color: #166534; margin-bottom: 10px;">
            &#127919; ${event.reasons.map((r) => escapeHtml(r)).join(" &bull; ")}
          </div>`
          : "";

      return `
        <div style="margin-bottom: 20px; padding: 16px; border: 2px solid #000000; background-color: #f7f7f5;">
          <div style="font-size: 11px; font-weight: 800; font-family: monospace; text-transform: uppercase; color: #4b5563; margin-bottom: 4px;">
            ${safeClub} &bull; ${formattedDate}
          </div>
          <div style="font-size: 18px; font-weight: 900; margin-bottom: 8px;">
            ${safeTitle}
          </div>
          <div style="font-size: 13px; font-family: monospace; color: #374151; margin-bottom: 12px;">
            &#128205; Location: ${safeLocation}
          </div>
          ${reasonsHtml}
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
  <title>CampusConnect Weekly Digest - Events Picked For You</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f5; color: #000000; margin: 0; padding: 0;">
  <div style="max-width: 580px; margin: 32px auto; background-color: #ffffff; border: 3px solid #000000; box-shadow: 6px 6px 0px #000000; padding: 28px;">
    <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px solid #000000;">
      CAMPUS<span style="background-color: #000000; color: #ffffff; padding: 2px 8px;">CONNECT</span>
      <div style="font-size: 12px; font-family: monospace; font-weight: 700; color: #4b5563; margin-top: 4px; text-transform: uppercase;">
        &#128293; Weekly Digest &mdash; Picked Just For You
      </div>
    </div>
    <div style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
      <p>Hey ${safeName}! Here are ${events.length} upcoming event${events.length === 1 ? "" : "s"} we think you&rsquo;ll love over the next 7 days:</p>
      ${eventItemsHtml}
    </div>
    <div style="text-align: center; margin: 28px 0 16px 0;">
      <a href="${safeAppUrl}/events" target="_blank" style="display: inline-block; background-color: #000000; color: #ffffff; font-weight: 800; font-family: monospace; text-transform: uppercase; text-decoration: none; padding: 12px 24px; border: 2px solid #000000; font-size: 13px;">
        Explore All Events on CampusConnect &rarr;
      </a>
    </div>
    <div style="margin-top: 32px; font-size: 11px; font-family: monospace; color: #6b7280; border-top: 2px solid #e5e7eb; padding-top: 16px;">
      <p>You received this email because you opted into the weekly CampusConnect digest.</p>
      <p>To update your preferences, visit <a href="${safeAppUrl}/settings" style="color: #2563eb;">your account settings</a>, or
        <a href="${safeUnsubscribeUrl}" style="color: #2563eb;">unsubscribe from weekly digest emails</a>.</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

// Dispatch a single personalized digest email via Resend (or mock mode)
async function dispatchDigestEmail(opts: {
  user: DigestUser;
  html: string;
  subject: string;
  unsubscribeUrl: string;
  resendApiKey: string | undefined;
  mockMode: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { user, html, subject, unsubscribeUrl, resendApiKey, mockMode } = opts;

  if (mockMode) {
    // user_id only - avoids PII in logs; user_id identifies the recipient for debugging.
    console.log(`[weekly-digest] Mock Mode: digest for user ${user.user_id}`);
    return { ok: true };
  }

  if (!resendApiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  const idempotencyKey = `weekly-digest-${new Date().toISOString().substring(0, 10)}-${user.user_id}`;

  // 1-click unsubscribe compliance (RFC 8058). These MUST be delivered as email
  // headers, so they go inside the Resend payload's `headers` field - Resend
  // ignores HTTP request headers for this purpose.
  const payload = {
    from: "CampusConnect Digest <notifications@campusconnect.app>",
    to: [user.email],
    subject,
    html,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };

  // Retry rate-limit responses (429) with short backoff; the daily per-user
  // Idempotency-Key makes retries safe against duplicate sends. Other failures
  // surface immediately so the cron (which retries the invocation) can retry.
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
      // A stalled request must not block every later recipient.
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 429 && attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "0");
      const delayMs = retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : attempt * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    const resData = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: `Resend API Error (${res.status}): ${JSON.stringify(resData)}` };
    }
    return { ok: true };
  }

  return { ok: false, error: "Exhausted retries for Resend dispatch" };
}

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const limited = await rateLimiter(req, "weekly-digest", 5, 3600);
  if (limited) return limited;

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

    // 2. Query events happening in the NEXT 7 days
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString();
    const next7DaysStr = next7Days.toISOString();

    const { data: rawEvents, error: eventsError } = await supabase
      .from("events")
      .select("id, title, event_date, location, club_id, clubs(name), event_tags(tag_path)")
      .gte("event_date", nowStr)
      .lte("event_date", next7DaysStr)
      .is("deleted_at", null)
      .eq("status", "scheduled")
      .order("event_date", { ascending: true });

    if (eventsError) throw new Error(`Failed to fetch upcoming events: ${eventsError.message}`);

    const digestEvents: DigestEvent[] = (rawEvents ?? []).map((e) => {
      const club = Array.isArray(e.clubs) ? e.clubs[0] : e.clubs;
      return {
        id: e.id,
        title: e.title,
        event_date: e.event_date,
        location: e.location ?? null,
        club_id: e.club_id ?? null,
        club_name: club?.name ?? null,
        tag_paths: Array.isArray(e.event_tags) ? e.event_tags.map((t) => t.tag_path) : [],
      };
    });

    if (digestEvents.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No upcoming events in the next 7 days. Skipping newsletter digest.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Fetch subscribers (strictly excludes marketing opt-outs via the RPC)
    const { data: subscribers, error: subError } = await supabase.rpc("get_digest_subscribers");
    if (subError) throw new Error(`Failed to fetch newsletter subscribers: ${subError.message}`);

    const users = (subscribers ?? []).filter((u: DigestUser) =>
      Boolean(u.user_id && u.email && u.email.includes("@")),
    ) as DigestUser[];

    if (users.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscribers opted into newsletter digest." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Load personalization data in a few batched queries (avoid N+1 per user)
    const eventIds = digestEvents.map((e) => e.id);
    const clubIds = Array.from(
      new Set(digestEvents.map((e) => e.club_id).filter((c): c is string => Boolean(c))),
    );

    // 4a. RSVPs within the window (any status except 'rejected' = already attending)
    const rsvpsByUser = new Map<string, Set<string>>();
    for (let i = 0; i < eventIds.length; i += 100) {
      const chunk = eventIds.slice(i, i + 100);
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("event_id, user_id, status")
        .in("event_id", chunk);
      if (error) throw new Error(`Failed to fetch RSVPs: ${error.message}`);
      for (const r of data ?? []) {
        if (!ATTENDING_RSVP_STATUSES.has(r.status)) continue;
        if (!rsvpsByUser.has(r.user_id)) rsvpsByUser.set(r.user_id, new Set());
        rsvpsByUser.get(r.user_id)!.add(r.event_id);
      }
    }

    // 4b. Approved club memberships ("clubs they follow")
    const clubsByUser = new Map<string, Set<string>>();
    for (let i = 0; i < clubIds.length; i += 100) {
      const chunk = clubIds.slice(i, i + 100);
      const { data, error } = await supabase
        .from("club_members")
        .select("club_id, user_id")
        .eq("status", "approved")
        .in("club_id", chunk);
      if (error) throw new Error(`Failed to fetch club memberships: ${error.message}`);
      for (const m of data ?? []) {
        if (!clubsByUser.has(m.user_id)) clubsByUser.set(m.user_id, new Set());
        clubsByUser.get(m.user_id)!.add(m.club_id);
      }
    }

    // 4c. Events the user previously attended (attendance logs -> rsvps).
    // Scoped to the subscriber set only: a full event_attendance_logs scan would
    // cover every user, hit PostgREST's max-rows cap as history grows, and waste
    // the follow-up rsvp lookups on rows we discard anyway.
    const attendedEventsByUser = new Map<string, Set<string>>();
    const subscriberIds = users.map((u) => u.user_id);
    const subscriberRsvpInfo = new Map<string, { event_id: string; user_id: string }>();

    for (let i = 0; i < subscriberIds.length; i += 100) {
      const chunk = subscriberIds.slice(i, i + 100);
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("id, event_id, user_id")
        .in("user_id", chunk);
      if (error) throw new Error(`Failed to fetch subscriber RSVPs: ${error.message}`);
      for (const r of data ?? []) {
        subscriberRsvpInfo.set(r.id, { event_id: r.event_id, user_id: r.user_id });
      }
    }

    const subscriberRsvpIds = Array.from(subscriberRsvpInfo.keys());
    for (let i = 0; i < subscriberRsvpIds.length; i += 100) {
      const chunk = subscriberRsvpIds.slice(i, i + 100);
      const { data, error } = await supabase
        .from("event_attendance_logs")
        .select("rsvp_id")
        .in("rsvp_id", chunk);
      if (error) throw new Error(`Failed to fetch attendance logs: ${error.message}`);
      for (const l of data ?? []) {
        const info = subscriberRsvpInfo.get(l.rsvp_id);
        if (!info) continue;
        if (!attendedEventsByUser.has(info.user_id))
          attendedEventsByUser.set(info.user_id, new Set());
        attendedEventsByUser.get(info.user_id)!.add(info.event_id);
      }
    }

    // 4d. Tags attached to the events they attended
    const attendedEventIds = Array.from(
      new Set(Array.from(attendedEventsByUser.values()).flatMap((s) => Array.from(s))),
    );
    const tagsByEvent = new Map<string, string[]>();
    for (let i = 0; i < attendedEventIds.length; i += 100) {
      const chunk = attendedEventIds.slice(i, i + 100);
      const { data, error } = await supabase
        .from("event_tags")
        .select("event_id, tag_path")
        .in("event_id", chunk);
      if (error) throw new Error(`Failed to fetch attended event tags: ${error.message}`);
      for (const t of data ?? []) {
        if (!tagsByEvent.has(t.event_id)) tagsByEvent.set(t.event_id, []);
        tagsByEvent.get(t.event_id)!.push(t.tag_path);
      }
    }

    // 5. Personalize + dispatch per user
    const mockMode = Deno.env.get("MOCK_EMAIL") === "true" || Deno.env.get("DENO_ENV") === "test";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // user_id identifies every subscriber for debugging; email is deliberately
    // NOT kept in accumulators so responses and logs never carry PII.
    const sent: Array<{ user_id: string; event_ids: string[] }> = [];
    const skipped: Array<{ user_id: string; reason: string }> = [];
    const failed: Array<{ user_id: string; error: string }> = [];

    for (const user of users) {
      const ctx: DigestContext = {
        events: digestEvents,
        followedClubIds: clubsByUser.get(user.user_id) ?? new Set(),
        attendedTagPaths: new Set(
          Array.from(attendedEventsByUser.get(user.user_id) ?? new Set()).flatMap(
            (eventId) => tagsByEvent.get(eventId) ?? [],
          ),
        ),
        rsvpedEventIds: rsvpsByUser.get(user.user_id) ?? new Set(),
      };

      const picks = scoreAndSelectTopEvents(ctx, DEFAULT_TOP_N);
      if (picks.length === 0) {
        skipped.push({ user_id: user.user_id, reason: "no_recommendations" });
        continue;
      }

      // Ensure a per-user unsubscribe token exists (1-click unsubscribe)
      let unsubscribeToken = user.unsubscribe_token;
      if (!unsubscribeToken) {
        unsubscribeToken = crypto.randomUUID();
        const { error: tokenError } = await supabase
          .from("user_preferences")
          .upsert(
            { user_id: user.user_id, unsubscribe_token: unsubscribeToken },
            { onConflict: "user_id" },
          );
        if (tokenError) {
          failed.push({
            user_id: user.user_id,
            error: `unsubscribe token upsert failed: ${tokenError.message}`,
          });
          continue;
        }
      }

      const unsubscribeUrl = `${supabaseUrl}/functions/v1/digest-unsubscribe?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(unsubscribeToken)}`;
      const html = compileDigestHtml(user, picks, appUrl, unsubscribeUrl);
      const subject = `CampusConnect Weekly Digest: ${picks.length} event${picks.length === 1 ? "" : "s"} picked for you`;

      try {
        const result = await dispatchDigestEmail({
          user,
          html,
          subject,
          unsubscribeUrl,
          resendApiKey,
          mockMode,
        });
        if (!result.ok) {
          failed.push({ user_id: user.user_id, error: result.error ?? "send failed" });
        } else {
          sent.push({ user_id: user.user_id, event_ids: picks.map((p) => p.id) });
        }
      } catch (err) {
        failed.push({
          user_id: user.user_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (failed.length > 0) {
      return new Response(
        JSON.stringify({
          error: "One or more digest emails failed",
          sent_count: sent.length,
          skipped_count: skipped.length,
          failed_count: failed.length,
          failed: failed.slice(0, 20),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        message: "Personalized weekly digest dispatched successfully",
        sent_count: sent.length,
        skipped_count: skipped.length,
        total_subscribers: users.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
