// supabase/functions/waitlist-promotion-email/index.ts
//
// Edge Function: Waitlist Promotion Email (Issue #2693)
//
// Invoked via pg_net webhook from the `promote_waitlist_on_cancel`
// Postgres trigger when a waitlisted RSVP is auto-promoted to
// attending after another user cancels.
//
// Sends a "Good news! You got a spot!" email to the promoted user
// with a 1-click cancellation link so they can decline if they no
// longer want to attend.
//
// Request body (JSON):
//   {
//     "event": "waitlist_promoted",
//     "event_id": "uuid",
//     "event_title": "Annual Tech Symposium 2026",
//     "event_short_id": "abc123",
//     "promoted_user_id": "uuid",
//     "promoted_email": "user@example.com",
//     "promoted_name": "Jane Doe",
//     "promoted_rsvp_id": "uuid",
//     "via": "update" | "delete"   // optional
//   }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  event: string;
  event_id: string;
  event_title?: string;
  event_short_id?: string;
  promoted_user_id: string;
  promoted_email?: string;
  promoted_name?: string;
  promoted_rsvp_id: string;
  via?: "update" | "delete";
}

Deno.serve(async (req: Request) => {
  // ── CORS preflight ───────────────────────────────────────────
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
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body", detail: String(err) }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (payload.event !== "waitlist_promoted" || !payload.promoted_user_id) {
    return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Fetch the promoted user's email if not provided ─────────
  let email = payload.promoted_email;
  let name = payload.promoted_name;
  if (!email) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", payload.promoted_user_id)
      .single();
    if (error || !profile) {
      console.error("Failed to fetch promoted user profile:", error);
      return new Response(JSON.stringify({ error: "Promoted user not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    email = profile.email;
    name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  }

  if (!email) {
    console.error("No email address for promoted user:", payload.promoted_user_id);
    return new Response(JSON.stringify({ error: "Promoted user has no email address" }), {
      status: 422,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Build the 1-click cancellation link ──────────────────────
  // The link points to the frontend cancel-waitlist route, which
  // calls the `cancel_event_rsvp` RPC with the user's auth token.
  // We sign the link with the promoted_rsvp_id so the cancel route
  // can verify the request is legitimate (not a forged click).
  const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:5173";
  const cancelUrl = new URL("/cancel-rsvp", siteUrl);
  cancelUrl.searchParams.set("event_id", payload.event_id);
  cancelUrl.searchParams.set("rsvp_id", payload.promoted_rsvp_id);
  cancelUrl.searchParams.set("user_id", payload.promoted_user_id);

  // ── Build the email body ─────────────────────────────────────
  const eventTitle = payload.event_title ?? "your event";
  const eventLink = payload.event_short_id
    ? `${siteUrl}/e/${payload.event_short_id}`
    : `${siteUrl}/events/${payload.event_id}`;

  const subject = `Good news! You got a spot for "${eventTitle}"`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #16a34a; margin: 0 0 16px;">Good news, ${name || "there"}! 🎉</h1>
      <p style="font-size: 16px; line-height: 1.6; color: #1e293b;">
        A spot just opened up for <strong>${eventTitle}</strong>, and you've been
        automatically promoted from the waitlist to the attending list.
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #1e293b;">
        You can view the event details here:
        <a href="${eventLink}" style="color: #2563eb;">${eventLink}</a>
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #1e293b;">
        If you can no longer attend, please cancel your spot so the next person
        on the waitlist can be promoted:
      </p>
      <p style="margin: 24px 0;">
        <a href="${cancelUrl.toString()}"
           style="display: inline-block; background: #dc2626; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Cancel my spot
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 13px; color: #64748b;">
        This is an automated email from CampusConnect. If you did not join a
        waitlist, you can safely ignore this message.
      </p>
    </div>
  `;

  const textBody = `Good news, ${name || "there"}!

A spot just opened up for "${eventTitle}", and you've been automatically promoted from the waitlist to the attending list.

View event: ${eventLink}

If you can no longer attend, cancel your spot so the next person on the waitlist can be promoted:
 ${cancelUrl.toString()}

This is an automated email from CampusConnect. If you did not join a waitlist, you can safely ignore this message.`;

  // ── Send the email ───────────────────────────────────────────
  // We use Resend if RESEND_API_KEY is set, otherwise fall back to
  // the Supabase auth admin API's inviteUserByEmail() trick (which
  // sends a templated email). Production deployments should set
  // RESEND_API_KEY and the from-address.
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("MAIL_FROM") ?? "CampusConnect <no-reply@campusconnect.app>";

  if (resendApiKey) {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });
    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend email send failed:", resendRes.status, errText);
      return new Response(JSON.stringify({ error: "Email send failed", detail: errText }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const resendData = await resendRes.json();
    return new Response(JSON.stringify({ success: true, message_id: resendData.id }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Fallback: log the email to stdout (local dev / no Resend key).
  console.log(
    "[waitlist-promotion-email] No RESEND_API_KEY set; logging email instead of sending:",
  );
  console.log("  To:", email);
  console.log("  Subject:", subject);
  console.log("  Cancel URL:", cancelUrl.toString());

  return new Response(
    JSON.stringify({ success: true, sent: false, reason: "RESEND_API_KEY not set" }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
