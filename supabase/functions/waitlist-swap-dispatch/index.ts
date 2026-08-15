// supabase/functions/waitlist-swap-dispatch/index.ts
//
// Edge Function: Waitlist Swap Dispatch (Issue #2903)
//
// Handles two event types:
//   1. "swap_offer_created" — Sends an SMS (or defers to Quiet Hours)
//      to the waitlisted user with a 15-minute claim link.
//   2. "dispatch_sms_outbox" — Cron-triggered. Sends all deferred
//      SMS messages whose send_after time has passed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Quiet Hours: 10 PM to 8 AM (in the user's timezone, default IST).
const QUIET_HOURS_START = 22; // 10 PM
const QUIET_HOURS_END = 8;   // 8 AM

interface SwapOfferPayload {
    event: string;
    offer_id: string;
    event_id: string;
    event_title?: string;
    event_short_id?: string;
    to_user_id: string;
    to_phone?: string;
    to_name?: string;
    claim_token: string;
    expires_at: string;
}

interface SmsOutboxRow {
    id: string;
    phone: string;
    message: string;
    swap_offer_id: string;
}

function isInQuietHours(date: Date = new Date()): boolean {
    const hour = date.getHours();
    if (QUIET_HOURS_START > QUIET_HOURS_END) {
        // Wraps midnight (e.g., 22 to 8)
        return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
    }
    return hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END;
}

function getNextSendTime(): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(QUIET_HOURS_END, 0, 0, 0); // 8:00 AM today
    if (now.getHours() >= QUIET_HOURS_START) {
        // If it's already past 10 PM, send at 8 AM tomorrow.
        next.setDate(next.getDate() + 1);
    }
    return next;
}

async function sendTwilioSms(phone: string, message: string): Promise<boolean> {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!accountSid || !authToken || !fromNumber) {
        console.log("[swap-dispatch] Twilio not configured. SMS to:", phone, "msg:", message);
        return false;
    }

    try {
        const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
                method: "POST",
                headers: {
                    "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    From: fromNumber,
                    To: phone,
                    Body: message,
                }),
            }
        );
        return response.ok;
    } catch (err) {
        console.error("[swap-dispatch] Twilio error:", err);
        return false;
    }
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:5173";

    if (!supabaseUrl || !serviceRoleKey) {
        return new Response(
            JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
            { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body;
    try {
        body = await req.json();
    } catch {
        return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
    }

    // ── Event 1: New swap offer created ─────────────────────────
    if (body.event === "swap_offer_created") {
        const payload = body as SwapOfferPayload;

        if (!payload.to_phone) {
            console.log("[swap-dispatch] No phone number for user:", payload.to_user_id);
            return new Response(
                JSON.stringify({ success: true, sms_sent: false, reason: "no_phone" }),
                { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
            );
        }

        const claimUrl = `${siteUrl}/claim-swap?token=${payload.claim_token}&offer=${payload.offer_id}`;
        const message = `A ticket just opened up for ${payload.event_title ?? "your event"}! Click here to claim it within 15 minutes: ${claimUrl}`;

        if (isInQuietHours()) {
            // Defer to 8 AM by writing to the sms_outbox.
            const sendAfter = getNextSendTime();
            const { error } = await supabase.from("sms_outbox").insert({
                phone: payload.to_phone,
                message,
                swap_offer_id: payload.offer_id,
                status: "pending",
                send_after: sendAfter.toISOString(),
            });

            if (error) {
                console.error("[swap-dispatch] Failed to defer SMS:", error);
                return new Response(
                    JSON.stringify({ success: false, error: "Failed to defer SMS" }),
                    { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
                );
            }

            console.log("[swap-dispatch] SMS deferred to", sendAfter.toISOString(), "for", payload.to_phone);
            return new Response(
                JSON.stringify({ success: true, sms_sent: false, deferred_to: sendAfter.toISOString() }),
                { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
            );
        } else {
            // Send immediately.
            const sent = await sendTwilioSms(payload.to_phone, message);
            return new Response(
                JSON.stringify({ success: true, sms_sent: sent }),
                { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
            );
        }
    }

    // ── Event 2: Cron-triggered SMS outbox dispatch ────────────
    if (body.event === "dispatch_sms_outbox") {
        const { data: pendingSms, error } = await supabase
            .from("sms_outbox")
            .select("id, phone, message, swap_offer_id")
            .eq("status", "pending")
            .lte("send_after", new Date().toISOString())
            .limit(50);

        if (error) {
            console.error("[swap-dispatch] Failed to fetch SMS outbox:", error);
            return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
            );
        }

        if (!pendingSms || pendingSms.length === 0) {
            return new Response(
                JSON.stringify({ success: true, dispatched: 0 }),
                { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
            );
        }

        let dispatched = 0;
        for (const sms of pendingSms as SmsOutboxRow[]) {
            // Check if the swap offer is still pending before sending.
            const { data: offer } = await supabase
                .from("waitlist_swap_offers")
                .select("status, expires_at")
                .eq("id", sms.swap_offer_id)
                .single();

            if (!offer || offer.status !== "pending" || new Date(offer.expires_at) < new Date()) {
                // Offer already claimed or expired — don't send the SMS.
                await supabase.from("sms_outbox").update({ status: "failed" }).eq("id", sms.id);
                continue;
            }

            const sent = await sendTwilioSms(sms.phone, sms.message);
            if (sent) {
                await supabase.from("sms_outbox").update({ status: "sent" }).eq("id", sms.id);
                dispatched++;
            } else {
                await supabase.from("sms_outbox").update({ status: "failed" }).eq("id", sms.id);
            }
        }

        return new Response(
            JSON.stringify({ success: true, dispatched }),
            { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({ error: "Unknown event type" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
});
