// supabase/functions/club-webhook-dispatcher/index.ts
//
// Edge Function: Centralized Webhook Dispatcher (Issue #2687)
//
// Receives event data + a webhook URL from the Postgres trigger,
// formats it into a Discord/Slack-compatible rich embed, and POSTs it.
// Handles timeouts and invalid URLs gracefully without crashing.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
    event_id: string;
    event_title: string;
    event_description: string | null;
    event_date: string | null;
    event_location: string | null;
    banner_url: string | null;
    club_name: string | null;
    webhook_url: string;
}

function formatDiscordEmbed(payload: WebhookPayload) {
    const dateStr = payload.event_date
        ? new Date(payload.event_date).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "TBD";

    return {
        username: "CampusConnect",
        embeds: [
            {
                title: `📅 New Event: ${payload.event_title}`,
                description: payload.event_description?.slice(0, 4000) || "No description provided.",
                color: 0x5865F2, // Discord Blurple
                fields: [
                    {
                        name: "📍 Location",
                        value: payload.event_location || "TBD",
                        inline: true,
                    },
                    {
                        name: "🕒 Date & Time",
                        value: dateStr,
                        inline: true,
                    },
                    {
                        name: "🏢 Hosted by",
                        value: payload.club_name || "Unknown Club",
                        inline: true,
                    },
                ],
                image: payload.banner_url
                    ? { url: payload.banner_url }
                    : undefined,
                footer: {
                    text: "Powered by CampusConnect",
                },
                timestamp: new Date().toISOString(),
            },
        ],
    };
}

function formatSlackMessage(payload: WebhookPayload) {
    const dateStr = payload.event_date
        ? `<!date^${Math.round(new Date(payload.event_date).getTime() / 1000)}^{date_short} at {time}|${new Date(payload.event_date).toLocaleString()}>`
        : "TBD";

    return {
        text: `📅 *New Event: ${payload.event_title}*`,
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `📅 ${payload.event_title}`,
                },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: payload.event_description?.slice(0, 2900) || "No description provided.",
                },
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Location:*\n${payload.event_location || "TBD"}`,
                    },
                    {
                        type: "mrkdwn",
                        text: `*Date & Time:*\n${dateStr}`,
                    },
                    {
                        type: "mrkdwn",
                        text: `*Hosted by:*\n${payload.club_name || "Unknown Club"}`,
                    },
                ],
            },
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: "Powered by CampusConnect",
                    },
                ],
            },
        ],
    };
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    let payload: WebhookPayload;
    try {
        payload = await req.json();
    } catch {
        return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
    }

    if (!payload.webhook_url) {
        return new Response(
            JSON.stringify({ error: "Missing webhook_url" }),
            { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
    }

    // ── URL validation ──────────────────────────────────────────
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(payload.webhook_url);
    } catch {
        console.error("[webhook-dispatcher] Invalid webhook URL:", payload.webhook_url);
        return new Response(
            JSON.stringify({ error: "Invalid webhook URL format" }),
            { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
    }

    // Only allow https:// (Discord and Slack require it)
    if (parsedUrl.protocol !== "https:") {
        console.error("[webhook-dispatcher] Webhook URL must use HTTPS:", payload.webhook_url);
        return new Response(
            JSON.stringify({ error: "Webhook URL must use HTTPS" }),
            { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
    }

    // ── Format payload ──────────────────────────────────────────
    const isDiscord = parsedUrl.hostname.includes("discord.com") || parsedUrl.hostname.includes("discordapp.com");
    const isSlack = parsedUrl.hostname.includes("slack.com") || parsedUrl.hostname.includes("hooks.slack.com");

    let formattedPayload: unknown;
    if (isSlack) {
        formattedPayload = formatSlackMessage(payload);
    } else {
        // Default to Discord format (also works for generic webhooks)
        formattedPayload = formatDiscordEmbed(payload);
    }

    // ── POST to the webhook with a 10s timeout ────────────────
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const response = await fetch(parsedUrl.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formattedPayload),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errText = await response.text();
            console.error(
                `[webhook-dispatcher] Webhook POST failed: ${response.status} ${errText}`
            );
            // Log the failure but return 200 so the trigger doesn't retry/error
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `Webhook returned ${response.status}`,
                    detail: errText.slice(0, 500),
                }),
                { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("[webhook-dispatcher] Network error:", err);
        // Failed deliveries are logged but do not disrupt the event creation flow
        return new Response(
            JSON.stringify({
                success: false,
                error: "Network error or timeout",
                detail: err instanceof Error ? err.message : String(err),
            }),
            { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
    }
});
