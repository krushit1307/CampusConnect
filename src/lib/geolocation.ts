// src/lib/geolocation.ts
// Issue: #4679 - Automated "Waitlist Promotion" Geographic Prioritization
// Description: TypeScript library functions for geolocation-based waitlist features

import { supabase } from "./supabase/client";

/**
 * Result of a location update operation
 */
export type LocationUpdateResult =
  { success: true; message: string } | { success: false; error: string };

/**
 * Result of a GPS ping request operation
 */
export type GPSPingRequestResult =
  { success: true; users_pinged: number; message: string } | { success: false; error: string };

/**
 * Update the current user's GPS location
 * This should be called from mobile apps when location is available
 *
 * @param latitude - User's current latitude (-90 to 90)
 * @param longitude - User's current longitude (-180 to 180)
 * @returns Result of the location update operation
 */
export async function updateUserLocation(
  latitude: number,
  longitude: number,
): Promise<LocationUpdateResult> {
  try {
    // Validate coordinates
    if (typeof latitude !== "number" || latitude < -90 || latitude > 90) {
      return { success: false, error: "Invalid latitude. Must be between -90 and 90." };
    }

    if (typeof longitude !== "number" || longitude < -180 || longitude > 180) {
      return { success: false, error: "Invalid longitude. Must be between -180 and 180." };
    }

    const { data, error } = await supabase.rpc("update_user_location", {
      p_latitude: latitude,
      p_longitude: longitude,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "No response from server." };
    }

    if (data.success === false) {
      return { success: false, error: data.error ?? "Unknown error" };
    }

    return { success: true, message: data.message ?? "Location updated successfully." };
  } catch (error: any) {
    return { success: false, error: error.message ?? "Unknown error occurred" };
  }
}

/**
 * Request GPS location updates from waitlisted users for an imminent event
 * This should be called when an event is less than 60 minutes away
 *
 * @param eventId - The event ID to request GPS pings for
 * @returns Result of the GPS ping request operation
 */
export async function requestGPSPingForWaitlist(eventId: string): Promise<GPSPingRequestResult> {
  try {
    const { data, error } = await supabase.functions.invoke("request-gps-ping", {
      body: { eventId },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "No response from server." };
    }

    if (data.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      users_pinged: data.users_pinged ?? 0,
      message: data.message ?? "GPS ping request completed",
    };
  } catch (error: any) {
    return { success: false, error: error.message ?? "Unknown error occurred" };
  }
}

/**
 * Get the current user's location from their profile
 *
 * @returns User's current location or null if not set
 */
export async function getUserLocation(): Promise<{
  latitude: number | null;
  longitude: number | null;
  last_updated: string | null;
} | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("latitude, longitude, last_location_updated_at")
      .single();

    if (error) {
      console.error("Error fetching user location:", error);
      return null;
    }

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      last_updated: data.last_location_updated_at,
    };
  } catch (error: any) {
    console.error("Error fetching user location:", error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * This is a client-side version of the Postgres haversine_distance function
 *
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get user's current GPS position from browser
 *
 * @returns Promise that resolves with coordinates or rejects with error
 */
export function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes cache
      },
    );
  });
}

/**
 * Update user's location using browser geolocation
 * This combines getCurrentPosition and updateUserLocation
 *
 * @returns Result of the location update operation
 */
export async function updateLocationFromBrowser(): Promise<LocationUpdateResult> {
  try {
    const position = await getCurrentPosition();
    return await updateUserLocation(position.latitude, position.longitude);
  } catch (error: any) {
    return { success: false, error: error.message ?? "Failed to get location" };
  }
}
