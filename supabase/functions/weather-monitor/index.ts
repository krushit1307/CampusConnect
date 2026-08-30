import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5/forecast";
const PRECIPITATION_THRESHOLD = 0.6;
const EXTREME_HEAT_CELSIUS = 35;
const WINDOW_HOURS = 72;

type ForecastPoint = {
  forecastTime: string;
  condition: string;
  precipitationProbability: number;
  temperatureC: number | null;
};

type WeatherAlert = {
  kind: "heavy_rain" | "snow" | "extreme_heat";
  label: string;
  forecast: ForecastPoint;
};

async function callOpenWeatherForecast(apiKey: string, lat: number, lon: number) {
  const params = new URLSearchParams({
    appid: apiKey,
    units: "metric",
    lat: String(lat),
    lon: String(lon),
  });
  const response = await fetch(`${OPENWEATHER_BASE}?${params.toString()}`);
  if (!response.ok) throw new Error(`OpenWeatherMap returned ${response.status}`);
  return response.json();
}

function getForecastPoints(payload: Record<string, unknown>): ForecastPoint[] {
  const list = Array.isArray(payload.list) ? payload.list : [];
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const point = entry as Record<string, unknown>;
    const weather = Array.isArray(point.weather) ? point.weather[0] : null;
    const weatherRecord =
      weather && typeof weather === "object" ? (weather as Record<string, unknown>) : {};
    const main =
      point.main && typeof point.main === "object" ? (point.main as Record<string, unknown>) : {};
    const forecastTime =
      typeof point.dt === "number" ? new Date(point.dt * 1000).toISOString() : "";
    if (!forecastTime) return [];
    return [
      {
        forecastTime,
        condition: String(weatherRecord.main || "unknown"),
        precipitationProbability: Number(point.pop) || 0,
        temperatureC: typeof main.temp === "number" ? main.temp : null,
      },
    ];
  });
}

function getSevereWeatherAlert(forecast: ForecastPoint): WeatherAlert | null {
  const condition = forecast.condition.toLowerCase();
  const probability =
    forecast.precipitationProbability > 1
      ? forecast.precipitationProbability / 100
      : forecast.precipitationProbability;

  if (
    (condition.includes("rain") || condition.includes("thunderstorm")) &&
    probability >= PRECIPITATION_THRESHOLD
  ) {
    return { kind: "heavy_rain", label: "heavy rain or thunderstorms", forecast };
  }
  if (condition.includes("snow") && probability >= PRECIPITATION_THRESHOLD) {
    return { kind: "snow", label: "snow", forecast };
  }
  if ((forecast.temperatureC ?? -Infinity) >= EXTREME_HEAT_CELSIUS) {
    return { kind: "extreme_heat", label: "extreme heat", forecast };
  }
  return null;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>\"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '\"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function getIndoorBackupPath(eventId: string, eventStart: string, eventEnd: string | null) {
  const params = new URLSearchParams({
    action: "find-indoor-backup",
    outdoor: "false",
    starts_at: eventStart,
  });
  if (eventEnd) params.set("ends_at", eventEnd);
  return `/events/${eventId}?${params.toString()}`;
}

async function sendPush(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  title: string,
  message: string,
  url: string,
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ user_id: userId, title, message, url }),
  });
  if (!response.ok) console.error(`Weather push failed for ${userId}: ${await response.text()}`);
}

async function sendEmail(
  to: string,
  subject: string,
  eventTitle: string,
  alert: WeatherAlert,
  backupUrl: string,
) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("RESEND_API_KEY is not configured; skipping weather email delivery.");
    return false;
  }

  const from =
    Deno.env.get("WEATHER_ALERT_FROM_EMAIL") ?? "CampusConnect Alerts <alerts@campusconnect.app>";
  const probability = Math.round(Math.min(1, alert.forecast.precipitationProbability) * 100);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: `<h2>Severe weather forecast for ${escapeHtml(eventTitle)}</h2><p>${escapeHtml(alert.label)} is forecast near the event time with a ${probability}% precipitation probability.</p><p><a href="${backupUrl}">Find an indoor backup venue</a></p>`,
    }),
  });
  if (!response.ok) console.error(`Weather email failed for ${to}: ${await response.text()}`);
  return response.ok;
}

serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const openweatherKey = Deno.env.get("OPENWEATHER_API_KEY");
  if (!openweatherKey || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Weather monitor secrets are not configured" }), {
      status: 500,
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date();
  const next72 = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);
  const { data: events, error } = await supabase
    .from("events")
    .select(
      "id, title, created_by, event_date, start_date, end_date, is_outdoor, location_lat, location_lon, latitude, longitude, venue_id, venues(id, name, is_outdoor, is_outdoors, latitude, longitude, postal_code)",
    )
    .gte("event_date", now.toISOString())
    .lte("event_date", next72.toISOString());

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let checked = 0;
  let alertsSent = 0;
  let emailsSent = 0;
  for (const event of events ?? []) {
    const venue = Array.isArray(event.venues) ? event.venues[0] : event.venues;
    if (!event.is_outdoor && !venue?.is_outdoor && !venue?.is_outdoors) continue;
    const eventStart = event.start_date || event.event_date;
    if (!eventStart) continue;
    const eventTime = new Date(eventStart).getTime();
    if (!Number.isFinite(eventTime) || eventTime < now.getTime() || eventTime > next72.getTime())
      continue;

    const latitude = Number(venue?.latitude ?? event.location_lat ?? event.latitude);
    const longitude = Number(venue?.longitude ?? event.location_lon ?? event.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    checked++;

    try {
      const forecast = await callOpenWeatherForecast(openweatherKey, latitude, longitude);
      const closest = getForecastPoints(forecast as Record<string, unknown>).sort(
        (left, right) =>
          Math.abs(Date.parse(left.forecastTime) - eventTime) -
          Math.abs(Date.parse(right.forecastTime) - eventTime),
      )[0];
      const alert = closest ? getSevereWeatherAlert(closest) : null;
      if (!alert || !event.created_by) continue;

      const backupPath = getIndoorBackupPath(event.id, eventStart, event.end_date);
      const publicAppUrl = Deno.env.get("PUBLIC_APP_URL") ?? supabaseUrl;
      const backupUrl = `${publicAppUrl}${backupPath}`;
      const { data: priorAlert } = await supabase
        .from("event_weather_alerts")
        .select("id")
        .eq("event_id", event.id)
        .eq("forecast_time", alert.forecast.forecastTime)
        .eq("condition", alert.kind)
        .maybeSingle();
      if (priorAlert) continue;

      const probability = Math.min(1, alert.forecast.precipitationProbability);
      await supabase.from("event_weather_alerts").insert({
        event_id: event.id,
        organizer_id: event.created_by,
        forecast_time: alert.forecast.forecastTime,
        condition: alert.kind,
        precipitation_probability: probability,
        temperature_c: alert.forecast.temperatureC,
        indoor_backup_url: backupUrl,
      });

      const message = `CRITICAL: Severe weather (${alert.label}) detected during your "${event.title}". Click here to instantly notify attendees of cancellation or a venue change: ${backupUrl}`;
      await supabase.from("notifications").insert({
        user_id: event.created_by,
        type: "alert",
        title: "CRITICAL: Severe Weather Warning for Outdoor Event",
        message,
        link: backupPath,
        entity_id: event.id,
        entity_type: "event",
      });
      await sendPush(
        supabaseUrl,
        serviceKey,
        event.created_by,
        "CRITICAL: Severe Weather Warning",
        message,
        backupPath,
      );

      const { data: organizer } = await supabase.auth.admin.getUserById(event.created_by);
      if (
        organizer.user?.email &&
        (await sendEmail(
          organizer.user.email,
          `Weather alert for ${event.title}`,
          event.title,
          alert,
          backupUrl,
        ))
      ) {
        emailsSent++;
      }
      alertsSent++;
    } catch (monitorError) {
      console.error(`Failed to process weather for event ${event.id}:`, monitorError);
    }
  }

  return new Response(
    JSON.stringify({ checked, alertsSent, emailsSent, windowHours: WINDOW_HOURS }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});
