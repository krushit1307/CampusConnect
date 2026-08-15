import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5/forecast";

const SEVERE_CONDITIONS = ["Thunderstorm", "Snow", "Extreme", "Rain"];

async function callOpenWeatherForecast(apiKey: string, lat: string, lon: string): Promise<any> {
  const params = new URLSearchParams();
  params.set("appid", apiKey);
  params.set("units", "metric");
  params.set("lat", lat);
  params.set("lon", lon);
  const response = await fetch(`${OPENWEATHER_BASE}?${params.toString()}`);
  if (!response.ok) throw new Error("Weather API Error");
  return response.json();
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const openweatherKey = Deno.env.get("OPENWEATHER_API_KEY");

  if (!openweatherKey) {
    return new Response(JSON.stringify({ error: "Missing OPENWEATHER_API_KEY" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get outdoor events in the next 48 hours that have a backup venue
  const now = new Date();
  const next48 = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, created_by, location_lat, location_lon, event_date")
    .eq("is_outdoor", true)
    .not("backup_indoor_venue", "is", null)
    .gte("event_date", now.toISOString())
    .lte("event_date", next48.toISOString());

  if (error) {
    console.error("Database error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!events || events.length === 0) {
    return new Response(JSON.stringify({ message: "No upcoming outdoor events to check." }));
  }

  // We can batch by location if needed, but for simplicity we will check each event
  // OpenWeatherMap allows 60 calls/minute for free.
  const campusLat = Deno.env.get("CAMPUS_LAT") ?? "0";
  const campusLon = Deno.env.get("CAMPUS_LON") ?? "0";

  let alertsSent = 0;

  for (const event of events) {
    const lat = event.location_lat?.toString() || campusLat;
    const lon = event.location_lon?.toString() || campusLon;

    try {
      const forecastData = await callOpenWeatherForecast(openweatherKey, lat, lon);
      const eventTime = new Date(event.event_date).getTime();

      // Find forecast closest to event time (3-hour steps)
      const closestForecast = forecastData.list?.reduce((prev: any, curr: any) => {
        return Math.abs(curr.dt * 1000 - eventTime) < Math.abs(prev.dt * 1000 - eventTime)
          ? curr
          : prev;
      });

      if (closestForecast) {
        const condition = closestForecast.weather[0]?.main;
        if (SEVERE_CONDITIONS.includes(condition) || condition === "Rain") {
          // Send notification to organizer
          await supabase.from("notifications").insert({
            user_id: event.created_by,
            type: "alert",
            title: "Severe Weather Forecasted",
            message: `Severe weather (${condition}) is forecasted for "${event.title}". Tap here to automatically shift to your backup venue and notify all attendees.`,
            link: `/events/${event.id}?action=weather-pivot`,
            entity_id: event.id,
            entity_type: "event",
          });
          alertsSent++;
        }
      }
    } catch (err) {
      console.error(`Failed to fetch weather for event ${event.id}:`, err);
    }
  }

  return new Response(
    JSON.stringify({ message: `Processed ${events.length} events, sent ${alertsSent} alerts.` }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});
