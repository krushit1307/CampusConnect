// =============================================================================
// Edge Function: Crosspost Event
// Issue: #3542 - Implement 'Automated Multi-Channel Cross-Posting'
// Description: Triggered when an event is published. Fetches active webhooks
// for the club, builds platform-specific rich embed payloads (Discord/Slack),
// and executes async POST requests to broadcast the announcement.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventData {
    id: string;
    title: string;
    description: string;
    event_date: string;
    location: string;
    cover_image_url: string | null;
    club_id: string;
    clubs?: { name: string; slug: string };
}

/**
 * Builds a Discord-compatible Rich Embed JSON payload.
 * Discord webhooks accept a specific JSON structure for beautiful embeds.
 */
function buildDiscordEmbed(event: EventData, appUrl: string) {
    const eventUrl = `${appUrl}/events/${event.id}`;
    const timestamp = new Date(event.event_date).toISOString();

    return {
        username: "CampusConnect Events",
        avatar_url: `${appUrl}/assets/logo.png`,
        embeds: [
            {
                title: `🎉 ${event.title}`,
                url: eventUrl,
                description: event.description.substring(0, 250) + (event.description.length > 250 ? "..." : ""),
                color: 5814783, // Indigo hex
                fields: [
                    { name: "📅 Date", value: `<t:${Math.floor(new Date(event.event_date).getTime() / 1000)}:F>`, inline: true },
                    { name: "📍 Location", value: event.location || "TBA", inline: true },
                    { name: "🏢 Host", value: event.clubs?.name || "Campus Club", inline: true },
                ],
                image: event.cover_image_url ? { url: event.cover_image_url } : undefined,
                footer: { text: "Click the title or button below to RSVP!" },
                timestamp: timestamp,
            },
        ],
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 5, // Link button
                        label: "🎟️ RSVP Here",
                        url: eventUrl,
                    },
                ],
            },
        ],
    };
}

/**
 * Builds a Slack-compatible Block Kit JSON payload.
 * Slack uses a different structure called "Blocks" for rich messages.
 */
function buildSlackPayload(event: EventData, appUrl: string) {
    const eventUrl = `${appUrl}/events/${event.id}`;

    return {
        text: `New Event: ${event.title}`, // Fallback for notifications
        blocks: [
            {
                type: "header",
                text: { type: "plain_text", text: `🎉 ${event.title}`, emoji: true },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: event.description.substring(0, 200) + (event.description.length > 200 ? "..." : ""),
                },
                accessory: event.cover_image_url ? {
                    type: "image",
                    image_url: event.cover_image_url,
                    alt_text: "Event Poster",
                } : undefined,
            },
            {
                type: "section",
                fields: [
                    { type: "mrkdwn", text: `*📅 Date:*\n<!date^${Math.floor(new Date(event.event_date).getTime() / 1000)}^{date_long} at {time}|${event.event_date}>` },
                    { type: "mrkdwn", text: `*📍 Location:*\n${event.location || "TBA"}` },
                    { type: "mrkdwn", text: `*🏢 Host:*\n${event.clubs?.name || "Campus Club"}` },
                ],
            },
            { type: "divider" },
            {
                type: "actions",
                elements: [
                    {
                        type: "button",
                        text: { type: "plain_text", text: "🎟️ RSVP Now", emoji: true },
                        url: eventUrl,
                        style: "primary",
                    },
                ],
            },
        ],
    };
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { event_id, is_test = false, integration_id } = await req.json();
        if (!event_id && !integration_id) throw new Error("Missing event_id or integration_id");

        const appUrl = Deno.env.get("APP_URL") || "https://campusconnect.app";

        // 1. Fetch Event Data (if not a pure test ping)
        let event: EventData | null = null;
        if (event_id) {
            const { data: eventData, error: eventError } = await supabaseAdmin
                .from("events")
                .select("*, clubs(name, slug)")
                .eq("id", event_id)
                .single();

            if (eventError || !eventData) throw new Error("Event not found");
            event = eventData as EventData;
        }

        // 2. Fetch Active Integrations
        let query = supabaseAdmin
            .from("club_integrations")
            .select("*")
            .eq("is_active", true);

        if (integration_id) {
            query = query.eq("id", integration_id);
        } else if (event) {
            query = query.eq("club_id", event.club_id);
        }

        const { data: integrations, error: intError } = await query;
        if (intError) throw intError;
        if (!integrations || integrations.length === 0) {
            return new Response(JSON.stringify({ message: "No active integrations found." }), { headers: corsHeaders });
        }

        // 3. Broadcast to all webhooks asynchronously
        const broadcastPromises = integrations.map(async (integration) => {
            let payload: any;

            if (is_test && !event) {
                // Simple test ping
                payload = integration.platform === "discord"
                    ? { content: "✅ CampusConnect webhook test successful!" }
                    : { text: "✅ CampusConnect webhook test successful!" };
            } else if (event) {
                if (integration.platform === "discord") {
                    payload = buildDiscordEmbed(event, appUrl);
                } else if (integration.platform === "slack") {
                    payload = buildSlackPayload(event, appUrl);
                } else {
                    return; // Unsupported platform
                }
            }

            try {
                const response = await fetch(integration.webhook_url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                const status = response.ok ? "success" : "failed";

                // Update last tested status if it was a test
                if (is_test) {
                    await supabaseAdmin
                        .from("club_integrations")
                        .update({ last_tested_at: new Date().toISOString(), last_test_status: status })
                        .eq("id", integration.id);
                }

                if (!response.ok) {
                    console.error(`[Crosspost] Failed to send to ${integration.platform}:`, await response.text());
                }
            } catch (fetchErr) {
                console.error(`[Crosspost] Network error for ${integration.platform}:`, fetchErr);
                if (is_test) {
                    await supabaseAdmin
                        .from("club_integrations")
                        .update({ last_tested_at: new Date().toISOString(), last_test_status: "failed" })
                        .eq("id", integration.id);
                }
            }
        });

        await Promise.all(broadcastPromises);

        return new Response(
            JSON.stringify({ success: true, broadcasted_to: integrations.length }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[CrosspostEvent] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
