import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 5;

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number | string;
    osm_type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string;
  };
}

interface LocationSuggestion {
  id: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  provider: "photon";
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").slice(0, 200).toLowerCase();
}

function formatAddress(properties: PhotonFeature["properties"] = {}) {
  const street = [properties.housenumber, properties.street].filter(Boolean).join(" ");
  const parts = [
    properties.name,
    street,
    properties.city || properties.district,
    properties.state,
    properties.postcode,
    properties.country,
  ].filter(Boolean);
  return [...new Set(parts)].join(", ") || "Unnamed location";
}

function normalizeFeature(feature: PhotonFeature, index: number): LocationSuggestion | null {
  const coordinates = feature.geometry?.coordinates;
  const [longitude, latitude] = coordinates || [];
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const properties = feature.properties || {};
  const providerId = [properties.osm_type, properties.osm_id].filter(Boolean).join(":");
  return {
    id: providerId || `photon-${index}-${latitude}-${longitude}`,
    formatted_address: formatAddress(properties),
    latitude,
    longitude,
    provider: "photon",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const rawQuery = new URL(req.url).searchParams.get("q") || "";
    const query = normalizeQuery(rawQuery);
    if (query.length < 3) return json({ suggestions: [] });

    const now = new Date();
    const { data: cached, error: cacheError } = await supabase
      .from("location_search_cache")
      .select("results, provider, fetched_at")
      .eq("normalized_query", query)
      .gt("expires_at", now.toISOString())
      .maybeSingle();
    if (cacheError) throw cacheError;

    if (cached) {
      return json({
        suggestions: cached.results,
        provider: cached.provider,
        cached: true,
        fetched_at: cached.fetched_at,
      });
    }

    const language = req.headers.get("Accept-Language")?.split(",")[0]?.trim() || "en";
    const providerUrl = new URL("https://photon.komoot.io/api/");
    providerUrl.searchParams.set("q", query);
    providerUrl.searchParams.set("limit", String(MAX_RESULTS));
    providerUrl.searchParams.set("lang", language.split("-")[0]);

    const providerResponse = await fetch(providerUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CampusConnect event location search/1.0",
      },
    });
    if (!providerResponse.ok) {
      return json({ error: "Location provider temporarily unavailable" }, 503);
    }

    const payload = (await providerResponse.json()) as { features?: PhotonFeature[] };
    const suggestions = (payload.features || [])
      .slice(0, MAX_RESULTS)
      .map(normalizeFeature)
      .filter((suggestion): suggestion is LocationSuggestion => suggestion !== null);
    const fetchedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MS).toISOString();

    const { error: upsertError } = await supabase.from("location_search_cache").upsert(
      {
        normalized_query: query,
        results: suggestions,
        provider: "photon",
        fetched_at: fetchedAt,
        expires_at: expiresAt,
      },
      { onConflict: "normalized_query" },
    );
    if (upsertError) throw upsertError;

    return json({ suggestions, provider: "photon", cached: false, fetched_at: fetchedAt });
  } catch (error: unknown) {
    console.error("[location-search] Error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
