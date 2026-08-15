import { createClient } from "./supabase/client";

export const HUNT_CHECKIN_RADIUS_METERS = 15;

export interface WaypointClue {
  waypoint_id: string;
  step_order: number;
  clue_text: string;
  lat: number;
  lng: number;
  points: number;
  total_steps: number;
  current_score: number;
}

export interface CheckinResult {
  success: boolean;
  message: string;
  new_step: number;
  total_score: number;
  is_completed: boolean;
}

/**
 * Calculates exact distance in meters between two GPS coordinates using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Evaluates whether a student's current GPS position is within the 15-meter check-in radius.
 */
export function isWithinRadius(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters = HUNT_CHECKIN_RADIUS_METERS,
): boolean {
  const distance = calculateHaversineDistance(userLat, userLng, targetLat, targetLng);
  return distance <= radiusMeters;
}

/**
 * Anti-Cheating RPC call: Fetches ONLY the current active step's clue and coordinates.
 * Future waypoints remain hidden on the server to prevent network tab inspection.
 */
export async function getCurrentWaypoint(
  huntId: string,
  userId: string,
): Promise<{ success: boolean; data?: WaypointClue; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_current_waypoint_clue", {
    p_hunt_id: huntId,
    p_user_id: userId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const waypoint = data?.[0];
  return { success: true, data: waypoint };
}

/**
 * Verifies waypoint check-in via 15-meter GPS Haversine radius or QR code match fallback.
 */
export async function verifyCheckin(
  huntId: string,
  userId: string,
  userLat: number,
  userLng: number,
  qrCode?: string,
): Promise<CheckinResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("verify_waypoint_checkin", {
    p_hunt_id: huntId,
    p_user_id: userId,
    p_user_lat: userLat,
    p_user_lng: userLng,
    p_qr_code: qrCode ?? null,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
      new_step: 1,
      total_score: 0,
      is_completed: false,
    };
  }

  const res = data?.[0];
  return {
    success: res?.success ?? false,
    message: res?.message ?? "Check-in failed.",
    new_step: res?.new_step ?? 1,
    total_score: res?.total_score ?? 0,
    is_completed: res?.is_completed ?? false,
  };
}
