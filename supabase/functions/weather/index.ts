// Supabase Edge Function: /api/weather
// issue #1915 — wraps the OpenWeather Current Weather API and translates the
// upstream response into the WeatherSnapshot contract used by the React widget.
//
// Caches successful responses for 30 minutes (per the spec's "weather doesn't
// change rapidly and API limits are strict" reasoning) inside the function's
// module scope. We intentionally keep the cache in-memory — the function is
// stateless across cold starts and that's acceptable since each cold start
// already costs an OpenWeather request for cold users.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5/weather";

// Coarse condition buckets the React icon set covers. Anything we don't
// recognize falls through to "unknown" (which renders the fail-open UI).
function bucketCondition(main: string | undefined): string {
  switch (main) {
    case "Clear":
      return "clear";
    case "Clouds":
      return "clouds";
    case "Rain":
      return "rain";
    case "Drizzle":
      return "drizzle";
    case "Thunderstorm":
      return "thunderstorm";
    case "Snow":
      return "snow";
    case "Mist":
    case "Fog":
    case "Haze":
    case "Smoke":
      return "mist";
    default:
      return "unknown";
  }
}

interface CachedSnapshot {
  expiresAt: number;
  body: unknown;
  status: number;
}

// Module-level cache survives warm invocations. The key is the lat,lng or
// zip code; both are normalized through a single helper so equivalent
// requests share the same slot.
const cache = new Map<string, CachedSnapshot>();

function cacheKey(req: Request, url: URL): string {
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  if (lat && lon) return `coords:${lat},${lon}`;
  const q = url.searchParams.get("q");
  if (q) return `q:${q.toLowerCase()}`;

  // Fall back to the configured campus default — the Edge Function owns this
  // choice because the React layer must not see the secret/API key.
  const defaultLat = Deno.env.get("CAMPUS_LAT") ?? "";
  const defaultLon = Deno.env.get("CAMPUS_LON") ?? "";
  if (defaultLat && defaultLon) return `coords:${defaultLat},${defaultLon}`;
  const defaultZip = Deno.env.get("CAMPUS_ZIP") ?? "";
  if (defaultZip) return `q:${defaultZip.toLowerCase()}`;
  return "default:none";
}

async function callOpenWeather(apiKey: string, params: URLSearchParams): Promise<Response> {
  params.set("appid", apiKey);
  params.set("units", "metric");
  return await fetch(`${OPENWEATHER_BASE}?${params.toString()}`);
}

function translate(upstream: Record<string, unknown>) {
  const main = (upstream.main ?? {}) as { temp?: number };
  const weatherList = Array.isArray(upstream.weather) ? upstream.weather : [];
  const firstWeather = (weatherList[0] ?? {}) as {
    main?: string;
    description?: string;
  };
  return {
    tempC: typeof main.temp === "number" ? Math.round(main.temp * 10) / 10 : 0,
    description: firstWeather.description ?? "Unknown",
    condition: bucketCondition(firstWeather.main),
    locationName: String(upstream.name ?? "Campus"),
    observedAt: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const key = cacheKey(req, url);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return new Response(JSON.stringify(hit.body), {
      status: hit.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Weather-Cache": "HIT",
      },
    });
  }

  const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "OpenWeather API key not configured",
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const upstreamParams = new URLSearchParams();
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  const q = url.searchParams.get("q");
  if (lat && lon) {
    upstreamParams.set("lat", lat);
    upstreamParams.set("lon", lon);
  } else if (q) {
    upstreamParams.set("q", q);
  } else {
    const defaultLat = Deno.env.get("CAMPUS_LAT");
    const defaultLon = Deno.env.get("CAMPUS_LON");
    const defaultZip = Deno.env.get("CAMPUS_ZIP");
    if (defaultLat && defaultLon) {
      upstreamParams.set("lat", defaultLat);
      upstreamParams.set("lon", defaultLon);
    } else if (defaultZip) {
      upstreamParams.set("zip", defaultZip);
    } else {
      return new Response(
        JSON.stringify({ error: "No location provided and no campus default configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  let upstream: Response;
  try {
    upstream = await callOpenWeather(apiKey, upstreamParams);
  } catch (err) {
    console.error("OpenWeather fetch failed:", err);
    return new Response(
      JSON.stringify({ error: "Weather provider unreachable" }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!upstream.ok) {
    const body = await upstream.text();
    console.error("OpenWeather error:", upstream.status, body);
    return new Response(
      JSON.stringify({
        error: upstream.status === 401 ? "Invalid API key" : "Weather provider error",
      }),
      {
        status: upstream.status === 401 ? 503 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const raw = await upstream.json();
  const snapshot = translate(raw);
  const payload = JSON.stringify(snapshot);

  cache.set(key, {
    body: snapshot,
    expiresAt: now + CACHE_TTL_MS,
    status: 200,
  });

  return new Response(payload, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-Weather-Cache": "MISS",
      "Cache-Control": "public, max-age=1800",
    },
  });
});
