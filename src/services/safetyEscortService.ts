// =============================================================================
// Service: SafetyEscortService
// Issue: #3295 - Interactive Campus Safety Escort Integration
// Description: API helper service for evaluating late-night event schedules,
// capturing user GPS location, and submitting Campus Security or Buddy System
// safety escort requests.
// =============================================================================

import { createClient } from "../lib/supabase/client";

export interface SafetyEscortRequestParams {
  eventId?: string;
  requestType: "campus_security" | "buddy_system";
  currentLocation: string;
  destinationDorm: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface SafetyEscortRPCResult {
  success: boolean;
  request_id?: string;
  request_type?: string;
  status?: string;
  message?: string;
  emergency_disclaimer?: string;
  error?: string;
}

/**
 * Evaluates whether an event's schedule or end time falls in the late-night window
 * between 21:00 (9:00 PM) and 05:00 (5:00 AM).
 */
export function isLateNightEvent(eventTime?: string | Date): boolean {
  if (!eventTime) return true; // Default to true if unstated for safety

  const dateObj = new Date(eventTime);
  if (isNaN(dateObj.getTime())) {
    // If passed formatted string like "Friday, Oct 28 @ 10:00 PM"
    const str = String(eventTime).toLowerCase();
    return (
      str.includes("9:") ||
      str.includes("10:") ||
      str.includes("11:") ||
      str.includes("12:") ||
      str.includes("1:") ||
      str.includes("2:") ||
      str.includes("3:") ||
      str.includes("4:") ||
      str.includes("pm") ||
      str.includes("am")
    );
  }

  const hours = dateObj.getHours();
  // 21:00 (9 PM) to 23:59 or 00:00 to 05:00 (5 AM)
  return hours >= 21 || hours < 5;
}

/**
 * Captures user's current GPS location coordinates via navigator.geolocation.
 */
export async function getCurrentGPSLocation(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      { timeout: 5000 },
    );
  });
}

/**
 * Submits a safety escort request (Campus Security Dispatch or Virtual Buddy System).
 */
export async function requestSafetyEscort(
  params: SafetyEscortRequestParams,
): Promise<SafetyEscortRPCResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("request_safety_escort", {
    p_event_id: params.eventId || null,
    p_request_type: params.requestType,
    p_current_location: params.currentLocation,
    p_destination_dorm: params.destinationDorm,
    p_latitude: params.latitude || null,
    p_longitude: params.longitude || null,
  });

  if (error) {
    console.error("Error requesting safety escort:", error);
    return { success: false, error: error.message };
  }

  return data as SafetyEscortRPCResult;
}
