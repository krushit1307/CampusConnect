// Supabase Edge Function: GET /functions/v1/nearby-events?lat=<lat>&lng=<lng>&radius=<meters>
// Issue #2561 — [FEATURE] PostGIS Spatial Queries for mapping Events within 500 meters.
//
// Users open their phone and expect "events happening near me right now". Instead of
// fetching thousands of events and computing Haversine distance in JS on the client,
// this endpoint delegates the spatial math to native Postgres PostGIS via the
// get_events_nearby RPC, which runs `ST_DWithin(...)` against the GiST-indexed
// GEOGRAPHY(Point, 4326) column and orders results by true geodesic distance.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { corsHeaders } from "../_shared/validation.ts";
import { rateLimiter } from "../shared/rateLimiter.ts";

const DEFAULT_RADIUS_METERS = 500;
const MAX_RADIUS_METERS = 50_000;

const MIN_LAT = -90;
const MAX_LAT = 90;
const MIN_LNG = -180;
const MAX_LNG = 180;

export function parseCoordinate(raw: string | null, min: number, max: number): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Rate limit: 60 requests/minute (read-only, safe)
  const limited = await rateLimiter(req, "nearby-events", 60, 60);
  if (limited) return limited;

  const url = new URL(req.url);
  const lat = parseCoordinate(url.searchParams.get("lat"), MIN_LAT, MAX_LAT);
  const lng = parseCoordinate(url.searchParams.get("lng"), MIN_LNG, MAX_LNG);

  if (lat === null || lng === null) {
    return jsonResponse(
      {
        error: "lat and lng query parameters are required",
        hint: "Provide lat in [-90, 90] and lng in [-180, 180] as decimal degrees, e.g. /nearby-events?lat=37.7749&lng=-122.4194",
      },
      400,
    );
  }

  const radiusParam = url.searchParams.get("radius");
  const radius = radiusParam === null ? DEFAULT_RADIUS_METERS : Number(radiusParam);
  if (!Number.isFinite(radius) || radius <= 0 || radius > MAX_RADIUS_METERS) {
    return jsonResponse(
      {
        error: "radius must be a positive number in meters",
        hint: `Provide a radius in meters between 1 and ${MAX_RADIUS_METERS}, or omit it to use the default of ${DEFAULT_RADIUS_METERS} meters.`,
      },
      400,
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { data, error } = await supabase.rpc("get_events_nearby", {
      user_lat: lat,
      user_lng: lng,
      radius_meters: radius,
    });

    if (error) {
      console.error("[nearby-events] get_events_nearby RPC failed:", error);
      return jsonResponse({ error: error.message }, 500);
    }

    const events = Array.isArray(data) ? data : [];

    return new Response(
      JSON.stringify({
        success: true,
        count: events.length,
        radius_meters: radius,
        events,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60, s-maxage=120",
        },
      },
    );
  } catch (err) {
    console.error("[nearby-events] unhandled error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}

if (import.meta.main) {
  serve(handler);
}
