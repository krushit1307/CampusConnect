import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { verifyAuth } from "../shared/auth-middleware.ts";
import {
  buildInsuranceClaimPayload,
  dollarsToCents,
  type InsuranceWeatherSnapshot,
} from "../_shared/eventInsuranceClaim.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchLostRevenueCents(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
): Promise<number> {
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("payment_intent_id, paid_amount_cents")
    .eq("event_id", eventId);

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripe =
    stripeSecretKey && !stripeSecretKey.startsWith("mock-")
      ? new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" })
      : null;

  let total = 0;
  for (const rsvp of rsvps || []) {
    const fallback = Math.max(0, Number(rsvp.paid_amount_cents) || 0);
    if (stripe && rsvp.payment_intent_id) {
      try {
        const intent = await stripe.paymentIntents.retrieve(rsvp.payment_intent_id);
        total += intent.amount_received || intent.amount || fallback;
        continue;
      } catch (err) {
        console.error("[file-event-insurance-claim] Stripe PI lookup failed:", err);
      }
    }
    total += fallback;
  }
  return total;
}

async function fetchSunkCostsCents(
  supabase: ReturnType<typeof createClient>,
  clubId: string,
): Promise<number> {
  const { data: contracts } = await supabase
    .from("vendor_contracts")
    .select("amount")
    .eq("club_id", clubId);

  return (contracts || []).reduce((sum, row) => sum + dollarsToCents(Number(row.amount) || 0), 0);
}

function parseOpenWeather(body: Record<string, unknown>, observedAt: string): InsuranceWeatherSnapshot {
  const current = (body.data as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
  const weatherList = (current?.weather || body.weather) as { main?: string; description?: string }[] | undefined;
  const first = weatherList?.[0];
  const main = (body.main as Record<string, unknown> | undefined) || {};
  const wind = (body.wind as Record<string, unknown> | undefined) || {};
  return {
    source: "openweathermap",
    observed_at: observedAt,
    condition: first?.main,
    description: first?.description,
    temperature_c: Number(current?.temp ?? main.temp) || undefined,
    wind_speed_ms: Number(current?.wind_speed ?? wind.speed) || undefined,
    raw: body,
  };
}

async function fetchWeatherForCancellationDate(
  lat: number | null,
  lon: number | null,
  cancellationDate: string,
): Promise<InsuranceWeatherSnapshot | null> {
  const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
  if (!apiKey) return null;

  const resolvedLat = lat ?? Number(Deno.env.get("CAMPUS_LAT") || "");
  const resolvedLon = lon ?? Number(Deno.env.get("CAMPUS_LON") || "");
  if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLon)) return null;

  const dt = Math.floor(new Date(cancellationDate).getTime() / 1000);
  const timeMachineUrl =
    `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${resolvedLat}&lon=${resolvedLon}&dt=${dt}&units=metric&appid=${apiKey}`;
  const currentUrl =
    `https://api.openweathermap.org/data/2.5/weather?lat=${resolvedLat}&lon=${resolvedLon}&units=metric&appid=${apiKey}`;

  for (const url of [timeMachineUrl, currentUrl]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = (await res.json()) as Record<string, unknown>;
      return parseOpenWeather(body, cancellationDate);
    } catch (err) {
      console.error("[file-event-insurance-claim] Weather fetch failed:", err);
    }
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return json({ error: "Unauthorized" }, 401);
    }

    const { eventId, reason } = (await req.json().catch(() => ({}))) as {
      eventId?: string;
      reason?: string;
    };

    if (!eventId || !reason) {
      return json({ error: "Missing eventId or reason" }, 400);
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(
        "id, title, club_id, created_by, latitude, longitude, start_date, event_date, clubs(insurance_policy_id)",
      )
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return json({ error: "Event not found" }, 404);
    }

    if (event.created_by !== user.id) {
      return json({ error: "Forbidden: You do not own this event." }, 403);
    }

    const clubRow = event.clubs as { insurance_policy_id?: string | null } | { insurance_policy_id?: string | null }[] | null;
    const club = Array.isArray(clubRow) ? clubRow[0] : clubRow;
    const insurancePolicyId = (club?.insurance_policy_id || "").trim();
    if (!insurancePolicyId) {
      return json({ error: "No active insurance_policy_id on this club." }, 400);
    }

    const cancellationDate = new Date().toISOString();
    const lostRevenue = await fetchLostRevenueCents(supabase, eventId);
    const sunkCosts = event.club_id ? await fetchSunkCostsCents(supabase, event.club_id) : 0;
    const weather = await fetchWeatherForCancellationDate(
      event.latitude == null ? null : Number(event.latitude),
      event.longitude == null ? null : Number(event.longitude),
      cancellationDate,
    );

    const payload = buildInsuranceClaimPayload({
      insurance_policy_id: insurancePolicyId,
      event_id: event.id,
      event_title: event.title,
      cancellation_date: cancellationDate,
      reason,
      lost_revenue: lostRevenue,
      sunk_costs: sunkCosts,
      weather,
    });

    const webhookUrl = Deno.env.get("INSURANCE_UNDERWRITER_WEBHOOK_URL") || "";
    let underwriterStatus = "compiled";
    let underwriterResponse: unknown = null;

    if (webhookUrl) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const apiKey = Deno.env.get("INSURANCE_UNDERWRITER_API_KEY");
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const submitted = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const responseText = await submitted.text();
      try {
        underwriterResponse = JSON.parse(responseText);
      } catch {
        underwriterResponse = { body: responseText, status: submitted.status };
      }
      underwriterStatus = submitted.ok ? "submitted" : "failed";
    }

    const { data: claimRow, error: insertError } = await supabase
      .from("event_insurance_claims")
      .insert({
        event_id: event.id,
        club_id: event.club_id,
        insurance_policy_id: insurancePolicyId,
        reason,
        lost_revenue: lostRevenue,
        sunk_costs: sunkCosts,
        weather,
        payload,
        underwriter_status: underwriterStatus,
        underwriter_response: underwriterResponse,
      })
      .select("id, underwriter_status")
      .single();

    if (insertError) {
      console.error("[file-event-insurance-claim] Failed to store claim:", insertError);
      return json({ error: "Failed to store insurance claim", payload }, 500);
    }

    return json({
      success: true,
      claim_id: claimRow.id,
      underwriter_status: claimRow.underwriter_status,
      payload,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Insurance claim failed";
    console.error("[file-event-insurance-claim] Error:", error);
    return json({ error: message }, 500);
  }
});
