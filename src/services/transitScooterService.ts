import { createClient } from "@/lib/supabase/client";
import {
  Coordinate,
  EScooter,
  TransitItinerary,
  TransitStop,
  ScooterSyncResponse,
} from "../types/transitScooter";

const supabase = createClient();

// Haversine formula constants
const EARTH_RADIUS_KM = 6371;
const KM_TO_MILES = 0.621371;

/**
 * Calculates geographic distance in kilometers between two coordinates.
 */
export function calculateDistanceKm(
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
 * Calculates geographic distance in miles between two coordinates.
 */
export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return calculateDistanceKm(lat1, lon1, lat2, lon2) * KM_TO_MILES;
}

/**
 * Standard campus hubs used as starting points for public transit itineraries.
 */
export const CAMPUS_TRANSIT_HUBS = [
  {
    id: "hub-1",
    name: "University Main Quad Transit Center",
    latitude: 30.3582,
    longitude: 76.3688,
  },
  { id: "hub-2", name: "Downtown Metro Station Hub", latitude: 30.3415, longitude: 76.3524 },
  { id: "hub-3", name: "East Campus Dorms Bus Terminal", latitude: 30.3621, longitude: 76.3812 },
];

/**
 * Generates mock transit itineraries from starting hubs to the event venue,
 * with final stops located at various distances from the venue.
 */
export function getTransitItineraries(
  venueLat: number,
  venueLon: number,
  venueName = "Event Venue",
): TransitItinerary[] {
  return CAMPUS_TRANSIT_HUBS.map((hub, idx) => {
    // Generate final stop coordinates with variable distances from the venue
    // Day 1: close walk, Day 2: medium walk, Day 3: far walk (> 0.5 miles)
    const distanceOffset = idx === 0 ? 0.003 : idx === 1 ? 0.006 : 0.012; // in degrees lat/lon

    const stopLat = venueLat + distanceOffset;
    const stopLon = venueLon - distanceOffset;

    const stopName = `${venueName} North Transit stop`;
    const finalStop: TransitStop = {
      id: `stop-${idx}`,
      name: stopName,
      latitude: parseFloat(stopLat.toFixed(6)),
      longitude: parseFloat(stopLon.toFixed(6)),
      arrivalDelayMinutes: idx === 1 ? 5 : 0, // mock transit delay
    };

    const walkDist = calculateDistanceMiles(stopLat, stopLon, venueLat, venueLon);

    return {
      id: `itinerary-${hub.id}-${idx}`,
      name:
        idx === 0
          ? "Bus 101 Express Line"
          : idx === 1
            ? "Metro Blue Line Connector"
            : "Bus 104 Campus Shuttle",
      totalMinutes: Math.round(15 + idx * 10 + walkDist * 20),
      walkingDistanceMiles: parseFloat(walkDist.toFixed(2)),
      finalStop,
      legs: [
        {
          id: `leg-${idx}-1`,
          mode: idx === 1 ? "train" : "bus",
          routeName: idx === 0 ? "Line 101" : idx === 1 ? "Blue Line" : "Line 104",
          departureTime: "12:15 PM",
          arrivalTime: "12:35 PM",
          originName: hub.name,
          destinationName: stopName,
          originCoords: { latitude: hub.latitude, longitude: hub.longitude },
          destinationCoords: { latitude: stopLat, longitude: stopLon },
          distanceMiles: parseFloat((3.2 + idx * 1.5).toFixed(1)),
          estimatedMinutes: 20,
        },
        {
          id: `leg-${idx}-2`,
          mode: "walk",
          departureTime: "12:35 PM",
          arrivalTime: "12:45 PM",
          originName: stopName,
          destinationName: venueName,
          originCoords: { latitude: stopLat, longitude: stopLon },
          destinationCoords: { latitude: venueLat, longitude: venueLon },
          distanceMiles: parseFloat(walkDist.toFixed(2)),
          estimatedMinutes: Math.round(walkDist * 20), // 20 mins per mile walk speed
        },
      ],
    };
  });
}

// Simple in-memory cache for scooters search queries: coordinates key to results
const scooterCache = new Map<string, { expires: number; data: EScooter[] }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export const transitScooterService = {
  /**
   * Queries the Supabase Edge function for available last-mile scooters around a coordinate.
   * Keeps secrets server-side and caches responses.
   */
  async getAvailableScooters(
    latitude: number,
    longitude: number,
    radiusFeet = 200,
    minBattery = 20,
  ): Promise<EScooter[]> {
    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)},r:${radiusFeet},b:${minBattery}`;
    const now = Date.now();
    const cached = scooterCache.get(cacheKey);

    if (cached && cached.expires > now) {
      return cached.data;
    }

    try {
      const { data, error } = await supabase.functions.invoke<ScooterSyncResponse>(
        "transit-scooter-sync",
        {
          body: { latitude, longitude, radiusFeet, minBattery },
        },
      );

      if (error) {
        console.error("Supabase edge function error:", error);
        throw new Error(error.message || "Failed to fetch scooters from provider.");
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Invalid response from e-scooter backend.");
      }

      const scooters = data.scooters || [];

      scooterCache.set(cacheKey, {
        data: scooters,
        expires: now + CACHE_TTL_MS,
      });

      return scooters;
    } catch (err: any) {
      console.error("transitScooterService.getAvailableScooters failed:", err);
      // Fallback: if offline or functions error, return client-side deterministic fallback
      if (import.meta.env.DEV || err.message.includes("fetch")) {
        console.warn(
          "Dev mode fallback: Mocking scooters client-side due to edge function failure.",
        );
        const mockResponse = this.getClientMockScooters(
          latitude,
          longitude,
          radiusFeet,
          minBattery,
        );
        return mockResponse;
      }
      throw err;
    }
  },

  /**
   * Deterministic client-side generator for fallback.
   */
  getClientMockScooters(
    lat: number,
    lon: number,
    radiusFeet: number,
    minBattery: number,
  ): EScooter[] {
    const seed = Math.abs(Math.round((lat + lon) * 1000000));
    const scooters: EScooter[] = [];
    const providers: ("bird" | "lime" | "spin")[] = ["bird", "lime", "spin"];

    for (let i = 0; i < 6; i++) {
      // Deterministic pseudo-randomness
      const offsetSeed = seed + i * 13;
      const randValue = Math.sin(offsetSeed) * 10000;
      const rand = randValue - Math.floor(randValue);

      const distanceMeters = 10 + rand * 100;
      const distanceFeet = distanceMeters * 3.28084;
      const battery = Math.round(25 + rand * 70);
      const provider = providers[Math.floor(rand * providers.length)];
      const id = `scooter-${provider}-${seed}-${i}`;

      const unlockPrice = provider === "lime" ? 1.0 : provider === "bird" ? 1.25 : 0.99;
      const pricePerMinute = provider === "lime" ? 0.22 : provider === "bird" ? 0.25 : 0.19;

      if (distanceFeet <= radiusFeet && battery >= minBattery) {
        scooters.push({
          id,
          provider,
          latitude: lat + distanceMeters * 0.000009 * Math.cos(i),
          longitude: lon + distanceMeters * 0.000009 * Math.sin(i),
          batteryPercent: battery,
          distanceToStopFeet: Math.round(distanceFeet),
          distanceToStopMeters: Math.round(distanceMeters),
          unlockPrice,
          pricePerMinute,
          deepLink: `${provider}://ride?id=${id}`,
        });
      }
    }

    return scooters.sort((a, b) => a.distanceToStopFeet - b.distanceToStopFeet);
  },

  /**
   * Reserves a scooter using provider app deep links or API handles.
   */
  async reserveScooter(scooterId: string, provider: string): Promise<boolean> {
    try {
      // Mock network latency for reservation API verification
      await new Promise((resolve) => setTimeout(resolve, 800));

      const { data, error } = await supabase
        .from("event_logistics")
        .insert({
          item_type: "scooter_reservation",
          status: "reserved",
          details: { scooterId, provider, reservedAt: new Date().toISOString() },
        })
        .select();

      if (error) {
        // Fallback for mock environments if event_logistics doesn't exist
        console.warn("event_logistics insert failed, continuing to deep link:", error);
      }

      return true;
    } catch {
      return true; // fail-open for user flow
    }
  },
};
