import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-checkr-signature",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
async function secureEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a[i] ^ b[i];
  return result === 0;
}
async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "Student", last: parts.slice(1).join(" ") || "Candidate" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    if (req.method === "POST" && req.headers.has("x-checkr-signature")) {
      const rawBody = await req.text();
      const secret = Deno.env.get("CHECKR_WEBHOOK_SECRET");
      const supplied = req.headers.get("x-checkr-signature") || "";
      if (!secret || !(await secureEqual(supplied, await hmacHex(secret, rawBody))))
        return json({ error: "Invalid webhook signature." }, 401);
      const event = JSON.parse(rawBody) as {
        id?: string;
        type?: string;
        data?: { object?: Record<string, unknown> };
      };
      if (!event.id || !event.type) return json({ error: "Malformed webhook." }, 400);
      const { error: eventError } = await admin
        .from("club_leadership_background_check_events")
        .insert({ provider_event_id: event.id, event_type: event.type });
      if (eventError?.code === "23505") return json({ received: true, duplicate: true });
      if (eventError) throw eventError;
      if (event.type !== "report.completed") return json({ received: true });

      const report = event.data?.object || {};
      const reportId = text(report.id);
      const candidateId = text(report.candidate_id);
      const result = text(report.status || report.adjudication);
      const status =
        result.toLowerCase() === "clear"
          ? "clear"
          : result.toLowerCase() === "consider"
            ? "consider"
            : "failed";
      const { data: check, error: checkError } = await admin
        .from("club_leadership_background_checks")
        .select("id, member_id, requested_by, desired_role_id, status")
        .or(`provider_report_id.eq.${reportId},provider_candidate_id.eq.${candidateId}`)
        .limit(1)
        .maybeSingle();
      if (checkError) throw checkError;
      if (!check) return json({ received: true, unmatched: true });
      await admin
        .from("club_leadership_background_checks")
        .update({
          status,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: status === "failed" ? "Provider returned a non-clear result." : null,
        })
        .eq("id", check.id);
      if (status === "clear" && check.desired_role_id) {
        await admin
          .from("club_members")
          .update({ role_id: check.desired_role_id })
          .eq("id", check.member_id);
        await admin
          .from("notifications")
          .insert({
            user_id: check.requested_by,
            type: "background_check_clear",
            title: "Leadership background check cleared",
            message: "The requested high-risk club leadership role has been granted.",
            link: "/clubs",
          });
      } else if (status === "consider") {
        await admin
          .from("notifications")
          .insert({
            user_id: check.requested_by,
            type: "background_check_review",
            title: "Leadership background check needs review",
            message:
              "The background-check provider returned a Consider result. A Dean of Students review is required before leadership access can be granted.",
            link: "/admin",
          });
      }
      return json({ received: true });
    }

    const user = await verifyAuth(req, admin);
    const body = await req.json();
    if (body?.action === "review") {
      const { data: reviewer, error: reviewerError } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (reviewerError) throw reviewerError;
      if (!["admin", "system_admin", "owner"].includes(String(reviewer.role)))
        return json(
          { error: "Only an authorized Dean or system administrator can review Consider results." },
          403,
        );
      const checkId = text(body.check_id);
      const decision =
        body.decision === "clear" ? "clear" : body.decision === "failed" ? "failed" : null;
      if (!checkId || !decision)
        return json({ error: "check_id and a valid decision are required." }, 400);
      const { data: check, error: checkError } = await admin
        .from("club_leadership_background_checks")
        .select("id, member_id, requested_by, desired_role_id, status")
        .eq("id", checkId)
        .single();
      if (checkError) throw checkError;
      if (check.status !== "consider")
        return json({ error: "Only Consider results can be manually reviewed." }, 409);
      const { error: updateError } = await admin
        .from("club_leadership_background_checks")
        .update({
          status: decision,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          review_notes:
            decision === "clear"
              ? "Manual Dean review approved the pending leadership role."
              : "Manual Dean review declined the pending leadership role.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", check.id);
      if (updateError) throw updateError;
      if (decision === "clear" && check.desired_role_id)
        await admin
          .from("club_members")
          .update({ role_id: check.desired_role_id })
          .eq("id", check.member_id);
      await admin
        .from("notifications")
        .insert({
          user_id: check.requested_by,
          type:
            decision === "clear"
              ? "background_check_review_cleared"
              : "background_check_review_declined",
          title: decision === "clear" ? "Leadership review approved" : "Leadership review declined",
          message:
            decision === "clear"
              ? "The pending high-risk leadership role has been approved after manual review."
              : "The pending high-risk leadership role was declined after manual review.",
          link: "/clubs",
        });
      return json({ status: decision });
    }
    if (body?.action !== "request") return json({ error: "Unsupported action." }, 400);
    const clubId = text(body.club_id);
    const memberId = text(body.member_id);
    const desiredRoleId = text(body.desired_role_id);
    if (!clubId || !memberId || !desiredRoleId)
      return json({ error: "club_id, member_id, and desired_role_id are required." }, 400);

    const { data: club, error: clubError } = await admin
      .from("clubs")
      .select("id, risk_level")
      .eq("id", clubId)
      .single();
    if (clubError) throw clubError;
    if (club.risk_level !== "High_Minors")
      return json({ error: "This club does not require a background check." }, 400);
    const { data: requester } = await admin
      .from("club_members")
      .select("id, role, can_manage_permissions")
      .eq("club_id", clubId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle();
    if (!requester || (requester.role !== "admin" && !requester.can_manage_permissions))
      return json(
        { error: "Only authorized club administrators can request leadership vetting." },
        403,
      );
    const { data: member, error: memberError } = await admin
      .from("club_members")
      .select("id, user_id, role_id, profiles(full_name, email)")
      .eq("id", memberId)
      .eq("club_id", clubId)
      .single();
    if (memberError) throw memberError;
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    const { first, last } = splitName(text(profile?.full_name));
    const apiKey = Deno.env.get("CHECKR_API_KEY");
    const packageSlug = Deno.env.get("CHECKR_PACKAGE_SLUG");
    const apiBase = (Deno.env.get("CHECKR_API_BASE_URL") || "https://api.checkr.com/v1").replace(
      /\/$/,
      "",
    );
    if (!apiKey || !packageSlug)
      return json({ error: "Background-check provider is not configured." }, 503);
    const invitationResponse = await fetch(`${apiBase}/invitations`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${apiKey}:`)}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        candidate_email: text(profile?.email),
        candidate_first_name: first,
        candidate_last_name: last,
        package: packageSlug,
      }),
    });
    const invitation = await invitationResponse.json().catch(() => ({}));
    if (!invitationResponse.ok)
      return json(
        { error: "Could not create the provider-hosted background-check invitation." },
        502,
      );
    const { data: record, error: insertError } = await admin
      .from("club_leadership_background_checks")
      .upsert(
        {
          club_id: clubId,
          member_id: memberId,
          requested_by: user.id,
          desired_role_id: desiredRoleId,
          provider: "checkr",
          provider_candidate_id: invitation.candidate_id || null,
          provider_report_id: invitation.report_id || null,
          hosted_apply_url: invitation.invitation_url || invitation.uri || null,
          status: "pending",
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: "club_id,member_id" },
      )
      .select("id, status, hosted_apply_url")
      .single();
    if (insertError) throw insertError;
    return json({
      id: record.id,
      status: record.status,
      hosted_apply_url: record.hosted_apply_url,
      pii_notice:
        "Enter SSN, date of birth, and disclosures only in the provider-hosted flow. CampusConnect does not receive or store them.",
    });
  } catch (error) {
    console.error("[ClubLeadershipBackgroundCheck]", error);
    return json(
      { error: error instanceof Error ? error.message : "Unexpected background-check error." },
      500,
    );
  }
});
