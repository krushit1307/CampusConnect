// supabase/functions/stripe-representative-change-request/index.ts
//
// Edge Function: Stripe Connect Representative Change Request
//
// Invoked via pg_net webhook from execute_one_leadership_transition()
// in 20260827000000_leadership_transitions.sql, whenever a completed
// leadership transition involves a club that has a Stripe Connect
// account (clubs.stripe_account_id IS NOT NULL).
//
// IMPORTANT — this deliberately does NOT call the Stripe API to
// change the account's representative. Re-pointing a live Connect
// account's "representative" is a real KYC action: the new
// representative must personally complete identity verification
// through Stripe's own hosted onboarding (Account Links) — that
// cannot be triggered on someone's behalf by a webhook, an email, or
// a cron job. Attempting to fake that here would be actively
// misleading about what actually happened to the account.
//
// What this DOES do: reliably notify the incoming leader (who needs
// to start Stripe's onboarding flow themselves) and a finance/ops
// mailbox (who should track the handover to completion) that a
// representative change is now pending. The durable record of the
// pending change lives in stripe_representative_change_requests —
// this function's email is best-effort on top of that, not the
// source of truth.
//
// Request body (JSON):
//   {
//     "club_id": "uuid",
//     "club_title": "Robotics Club",
//     "transition_id": "uuid",
//     "new_representative_id": "uuid"
//   }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FINANCE_OPS_EMAIL = Deno.env.get("FINANCE_OPS_EMAIL") ?? "finance@campusconnect.example";

interface WebhookPayload {
  club_id: string;
  club_title?: string;
  transition_id: string;
  new_representative_id: string;
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
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body", detail: String(err) }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!payload.club_id || !payload.new_representative_id) {
    return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", payload.new_representative_id)
    .maybeSingle();

  const newRepName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "the new leader"
    : "the new leader";
  const clubTitle = payload.club_title ?? "your club";

  // This project doesn't have a generic transactional-email sender
  // wired up in this function set yet (see waitlist-promotion-email
  // for the nearest equivalent pattern) — logging clearly here is
  // intentional so this is visible in Function logs even before an
  // email provider is connected, rather than silently doing nothing.
  console.log(
    `[StripeRepChange] ${clubTitle} (${payload.club_id}): representative handover to ` +
      `${newRepName} (${payload.new_representative_id}) is pending manual completion. ` +
      `Notify finance ops at ${FINANCE_OPS_EMAIL} and direct ${newRepName} to Stripe's ` +
      `Connect onboarding flow to complete KYC verification.`,
  );

  return new Response(
    JSON.stringify({
      success: true,
      message: "Representative change logged for manual follow-up. No Stripe API call was made.",
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
