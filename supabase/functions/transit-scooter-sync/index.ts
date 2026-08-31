import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;
const FEET_PER_METER = 3.28084;
const METERS_PER_FOOT = 0.3048;

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface EScooter {
  id: string;
  provider: "bird" | "lime" | "spin";
  latitude: number;
  longitude: number;
  batteryPercent: number;
  distanceToStopFeet: number;
  distanceToStopMeters: number;
  unlockPrice: number;
  pricePerMinute: number;
  deepLink: string;
}

/**
 * Calculates distance between two coordinates in kilometers using the Haversine formula.
 */
function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Generates deterministic random numbers using a seed.
 */
class DeterministicRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  nextChoice<T>(choices: T[]): T {
    const idx = Math.floor(this.next() * choices.length);
    return choices[idx];
  }
}

/**
 * Generates e-scooters around a center coordinate.
 */
function generateDeterministicScooters(
  centerLat: number,
  centerLon: number,
  minBattery = 20,
): EScooter[] {
  // Use coordinates to seed the generator so same location returns identical scooters
  const seed = Math.abs(Math.round((centerLat + centerLon) * 1000000));
  const rand = new DeterministicRandom(seed);

  const providers: ("bird" | "lime" | "spin")[] = ["bird", "lime", "spin"];
  const scooters: EScooter[] = [];

  // Generate 8 candidate scooters at various distances/bearings
  const candidateCount = 8;
  for (let i = 0; i < candidateCount; i++) {
    // Distance in meters: from 5m to 120m
    const distanceMeters = rand.nextRange(5, 120);
    // Bearing in radians
    const bearing = rand.nextRange(0, 2 * Math.PI);

    // Approximate offset conversions: 1 degree latitude = ~111,111 meters
    const deltaLat = (distanceMeters * Math.cos(bearing)) / 111111;
    const deltaLon =
      (distanceMeters * Math.sin(bearing)) / (111111 * Math.cos((centerLat * Math.PI) / 180));

    const scooterLat = centerLat + deltaLat;
    const scooterLon = centerLon + deltaLon;

    // Calculate exact distance
    const distKm = calculateHaversineDistanceKm(centerLat, centerLon, scooterLat, scooterLon);
    const distMeters = distKm * 1000;
    const distFeet = distMeters * FEET_PER_METER;

    const battery = Math.round(rand.nextRange(5, 100));
    const provider = rand.nextChoice(providers);
    const id = `scooter-${provider}-${seed}-${i}`;

    const unlockPrice = provider === "lime" ? 1.0 : provider === "bird" ? 1.25 : 0.99;
    const pricePerMinute = provider === "lime" ? 0.22 : provider === "bird" ? 0.25 : 0.19;

    // Support provider-specific deep links with scooter ID preloaded
    const deepLink =
      provider === "lime"
        ? `lime://ride?id=${id}&partner=campusconnect`
        : provider === "bird"
          ? `bird://ride?id=${id}&source=campusconnect`
          : `spin://ride?id=${id}&ref=campusconnect`;

    // Filter low battery scooters out at the generation level for API fidelity
    if (battery >= minBattery) {
      scooters.push({
        id,
        provider,
        latitude: parseFloat(scooterLat.toFixed(6)),
        longitude: parseFloat(scooterLon.toFixed(6)),
        batteryPercent: battery,
        distanceToStopFeet: Math.round(distFeet),
        distanceToStopMeters: Math.round(distMeters),
        unlockPrice,
        pricePerMinute,
        deepLink,
      });
    }
  }

  // Sort by distance to stop ascending
  return scooters.sort((a, b) => a.distanceToStopFeet - b.distanceToStopFeet);
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { latitude, longitude, radiusFeet = 200, minBattery = 20 } = body;

    // Validate geographic coordinates
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Latitude and Longitude must be numbers.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid coordinates. Latitude [-90, 90] and Longitude [-180, 180].",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Configurable mobility provider integrations
    const birdApiKey = Deno.env.get("BIRD_API_KEY");
    const limeClientSecret = Deno.env.get("LIME_CLIENT_SECRET");
    let scooters: EScooter[] = [];

    // Timeout duration: 5 seconds
    const timeoutMs = 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (birdApiKey && limeClientSecret) {
        // Example representing Bird/Lime API calls using coordinate inputs
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${birdApiKey}`,
        };

        const [birdRes, limeRes] = await Promise.allSettled([
          fetch("https://api.birdapp.com/user/nearby", {
            method: "POST",
            headers,
            body: JSON.stringify({ latitude, longitude, radius: radiusFeet * METERS_PER_FOOT }),
            signal: controller.signal,
          }).then((r) => r.json()),
          fetch(`https://api.li.me/v1/lime-bike/location?lat=${latitude}&lng=${longitude}`, {
            method: "GET",
            headers: {
              ...headers,
              Authorization: `Bearer ${limeClientSecret}`,
            },
            signal: controller.signal,
          }).then((r) => r.json()),
        ]);

        clearTimeout(timeoutId);

        // Parse Bird response
        if (birdRes.status === "fulfilled" && birdRes.value && Array.isArray(birdRes.value.birds)) {
          birdRes.value.birds.forEach((b: any) => {
            const distKm = calculateHaversineDistanceKm(
              latitude,
              longitude,
              b.latitude,
              b.longitude,
            );
            const distMeters = distKm * 1000;
            const distFeet = distMeters * FEET_PER_METER;

            if (distFeet <= radiusFeet && b.battery_level >= minBattery) {
              scooters.push({
                id: String(b.id || b.code),
                provider: "bird",
                latitude: b.latitude,
                longitude: b.longitude,
                batteryPercent: b.battery_level,
                distanceToStopFeet: Math.round(distFeet),
                distanceToStopMeters: Math.round(distMeters),
                unlockPrice: 1.25,
                pricePerMinute: 0.25,
                deepLink: `bird://ride?id=${b.id}`,
              });
            }
          });
        }

        // Parse Lime response
        if (limeRes.status === "fulfilled" && limeRes.value && Array.isArray(limeRes.value.bikes)) {
          limeRes.value.bikes.forEach((b: any) => {
            const distKm = calculateHaversineDistanceKm(
              latitude,
              longitude,
              b.latitude,
              b.longitude,
            );
            const distMeters = distKm * 1000;
            const distFeet = distMeters * FEET_PER_METER;

            if (distFeet <= radiusFeet && b.battery_percent >= minBattery) {
              scooters.push({
                id: String(b.id),
                provider: "lime",
                latitude: b.latitude,
                longitude: b.longitude,
                batteryPercent: b.battery_percent,
                distanceToStopFeet: Math.round(distFeet),
                distanceToStopMeters: Math.round(distMeters),
                unlockPrice: 1.0,
                pricePerMinute: 0.22,
                deepLink: `lime://ride?id=${b.id}`,
              });
            }
          });
        }
      } else {
        clearTimeout(timeoutId);
        // Fallback to deterministic generation if keys are missing
        const generated = generateDeterministicScooters(latitude, longitude, minBattery);
        // Apply radius filter
        scooters = generated.filter((s) => s.distanceToStopFeet <= radiusFeet);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        return new Response(
          JSON.stringify({ success: false, error: "Mobility provider query timed out." }),
          {
            status: 504,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw err;
    }

    return new Response(
      JSON.stringify({
        success: true,
        provider: birdApiKey && limeClientSecret ? "live-aggregated" : "deterministic-mock",
        scooters,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("Scooter sync failed:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

serve(async (req) => {
  return await handler(req);
});
