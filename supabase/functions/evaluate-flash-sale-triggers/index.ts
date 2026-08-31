import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const OPENWEATHER_FORECAST = "https://api.openweathermap.org/data/2.5/forecast";
const BOOKMARK_EMAIL = "FLASH SALE: Tickets are 20% off for the next 24 hours!";

type TriggerRule = {
  id: string;
  event_id: string;
  trigger_type: "hours_before_event" | "weather_rain";
  hours_before: number | null;
};

type EventRow = {
  id: string;
  title: string | null;
  event_date: string | null;
  start_date: string | null;
  latitude: number | null;
  longitude: number | null;
  location_lat: number | null;
  location_lon: number | null;
};

function isHoursBeforeEventTriggerMet(
  eventStartIso: string | null | undefined,
  hoursBefore: number,
  now = new Date(),
): boolean {
  if (!eventStartIso || !Number.isFinite(hoursBefore) || hoursBefore <= 0) return false;
  const startMs = new Date(eventStartIso).getTime();
  if (!Number.isFinite(startMs)) return false;
  const remainingMs = startMs - now.getTime();
  return remainingMs > 0 && remainingMs <= hoursBefore * 60 * 60 * 1000;
}

function forecastPredictsRain(condition: string | null | undefined): boolean {
  const value = (condition || "").toLowerCase();
  return value.includes("rain") || value.includes("drizzle") || value.includes("thunderstorm");
}

function eventStartIso(event: EventRow): string | null {
  return event.start_date || event.event_date || null;
}

async function openWeatherPredictsRain(
  apiKey: string,
  lat: number,
  lon: number,
  eventStart: string | null,
): Promise<boolean> {
  const params = new URLSearchParams({
    appid: apiKey,
    units: "metric",
    lat: String(lat),
    lon: String(lon),
  });
  const response = await fetch(`${OPENWEATHER_FORECAST}?${params.toString()}`);
  if (!response.ok) throw new Error(`OpenWeather returned ${response.status}`);
  const payload = (await response.json()) as { list?: Array<{ dt?: number; weather?: Array<{ main?: string }> }> };
  const points = Array.isArray(payload.list) ? payload.list : [];
  if (points.length === 0) return false;

  const targetMs = eventStart ? new Date(eventStart).getTime() : Date.now();
  const closest = points
    .filter((point) => typeof point.dt === "number")
    .sort((a, b) => Math.abs((a.dt as number) * 1000 - targetMs) - Math.abs((b.dt as number) * 1000 - targetMs))[0];
  return forecastPredictsRain(closest?.weather?.[0]?.main);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";
  if (!serviceRoleKey || authorization !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !stripeSecretKey) {
    return new Response(JSON.stringify({ error: "Flash-sale trigger service is not configured" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
  const openWeatherKey = Deno.env.get("OPENWEATHER_API_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "CampusConnect <noreply@campusconnect.app>";

  const { data: rules, error: rulesError } = await admin
    .from("flash_sale_trigger_rules")
    .select("id, event_id, trigger_type, hours_before")
    .eq("enabled", true)
    .is("last_fired_at", null);
  if (rulesError) {
    return new Response(JSON.stringify({ error: rulesError.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  let fired = 0;
  const failures: string[] = [];

  for (const rule of (rules ?? []) as TriggerRule[]) {
    let pendingSaleId: string | null = null;
    try {
      const { data: event, error: eventError } = await admin
        .from("events")
        .select("id, title, event_date, start_date, latitude, longitude, location_lat, location_lon")
        .eq("id", rule.event_id)
        .maybeSingle();
      if (eventError || !event) continue;
      const row = event as EventRow;
      const start = eventStartIso(row);

      let shouldFire = false;
      if (rule.trigger_type === "hours_before_event") {
        shouldFire = isHoursBeforeEventTriggerMet(start, Number(rule.hours_before ?? 48));
      } else if (rule.trigger_type === "weather_rain") {
        if (!openWeatherKey) continue;
        const lat = Number(row.latitude ?? row.location_lat);
        const lon = Number(row.longitude ?? row.location_lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        shouldFire = await openWeatherPredictsRain(openWeatherKey, lat, lon, start);
      }
      if (!shouldFire) continue;

      const { data: created, error: createError } = await admin.rpc(
        "create_event_flash_sale_from_trigger",
        { p_rule_id: rule.id },
      );
      if (createError) throw new Error(createError.message);
      const payload = created as { success?: boolean; sale?: { id: string; sale_price_cents: number }; skipped?: string };
      if (!payload?.success || !payload.sale?.id) continue;
      pendingSaleId = payload.sale.id;

      const product = await stripe.products.create({
        name: `${row.title ?? "Event"} Flash Sale Ticket`,
        metadata: { event_id: rule.event_id, flash_sale_id: payload.sale.id, trigger_rule_id: rule.id },
      });
      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: payload.sale.sale_price_cents,
        product: product.id,
        metadata: { event_id: rule.event_id, flash_sale_id: payload.sale.id },
      });

      const { error: activateError } = await admin.rpc("activate_event_flash_sale", {
        p_sale_id: payload.sale.id,
        p_sale_stripe_price_id: price.id,
      });
      if (activateError) {
        await stripe.prices.update(price.id, { active: false });
        throw new Error(activateError.message);
      }

      await admin
        .from("flash_sale_trigger_rules")
        .update({ last_fired_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", rule.id);

      const { data: recipients } = await admin.rpc("get_flash_sale_bookmark_recipients", {
        p_event_id: rule.event_id,
      });
      for (const recipient of (recipients ?? []) as Array<{ user_id: string; email: string }>) {
        if (resendApiKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [recipient.email],
              subject: BOOKMARK_EMAIL,
              text: BOOKMARK_EMAIL,
            }),
          });
        } else {
          console.log(`[Email Dispatched] ${recipient.email}: ${BOOKMARK_EMAIL}`);
        }
      }

      fired += 1;
    } catch (error) {
      if (pendingSaleId) {
        await admin
          .from("event_flash_sales")
          .update({ status: "cancelled" })
          .eq("id", pendingSaleId)
          .eq("status", "pending");
      }
      failures.push(rule.id);
      console.error(`Flash-sale trigger ${rule.id} failed`, error);
    }
  }

  return new Response(JSON.stringify({ evaluated: (rules ?? []).length, fired, failures }), {
    status: failures.length ? 207 : 200,
    headers: jsonHeaders,
  });
});
