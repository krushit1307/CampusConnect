// =============================================================================
// Hook: useGeofencedCheckIn
// Feature: Geofenced Event Check-ins
// Description: Attendee-facing self check-in. Reads the device's GPS position
// via the browser Geolocation API (client-side, for instant UX feedback only)
// and calls the `check_in_via_geofence` Postgres RPC, which is the source of
// truth: it re-computes the haversine distance server-side and is the only
// path that can flip a normal user's own `checked_in` flag to true.
// =============================================================================

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type GeofenceCheckInStatus =
  | "idle"
  | "requesting_location"
  | "verifying"
  | "success"
  | "already_checked_in"
  | "too_far"
  | "error";

export interface GeofenceCheckInResult {
  status: GeofenceCheckInStatus;
  distanceMeters?: number;
  radiusMeters?: number;
  accuracyMeters?: number;
  errorMessage?: string;
  /** True when the event organizer has geofencing turned off for this event. */
  geofencingDisabled?: boolean;
}

// Accuracy worse than this (meters) is still attempted, but we surface a
// warning so the attendee understands why a borderline check-in might fail —
// this is the "indoor GPS is unreliable" edge case from the spec.
const LOW_ACCURACY_WARNING_THRESHOLD_METERS = 75;

// Standard GeolocationPositionError codes per the spec (avoid referencing the
// `GeolocationPositionError` global directly — it isn't polyfilled in jsdom
// test environments, and duck-typing here is equally correct in real browsers).
const GEOLOCATION_ERROR_PERMISSION_DENIED = 1;
const GEOLOCATION_ERROR_POSITION_UNAVAILABLE = 2;
const GEOLOCATION_ERROR_TIMEOUT = 3;

function isGeolocationPositionError(err: unknown): err is GeolocationPositionError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "number"
  );
}

function describeGeolocationError(err: GeolocationPositionError): string {
  switch (err.code) {
    case GEOLOCATION_ERROR_PERMISSION_DENIED:
      return "Location permission was denied. Enable location access for this site to check in, or ask an organizer to check you in manually.";
    case GEOLOCATION_ERROR_POSITION_UNAVAILABLE:
      return "Your device couldn't determine your location. Try moving outdoors or ask an organizer to check you in manually.";
    case GEOLOCATION_ERROR_TIMEOUT:
      return "Getting your location took too long. Please try again.";
    default:
      return "Couldn't get your location. Please try again.";
  }
}

function getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser doesn't support location services."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function useGeofencedCheckIn() {
  const [result, setResult] = useState<GeofenceCheckInResult>({ status: "idle" });
  const supabase = createClient();

  const checkIn = useCallback(
    async (rsvpId: string) => {
      setResult({ status: "requesting_location" });

      let position: GeolocationPosition;
      try {
        position = await getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      } catch (err) {
        const message = isGeolocationPositionError(err)
          ? describeGeolocationError(err)
          : err instanceof Error
            ? err.message
            : "Couldn't get your location.";
        setResult({ status: "error", errorMessage: message });
        return { status: "error" as const, errorMessage: message };
      }

      const { latitude, longitude, accuracy } = position.coords;
      const lowAccuracy = accuracy > LOW_ACCURACY_WARNING_THRESHOLD_METERS;

      setResult({ status: "verifying", accuracyMeters: accuracy });

      const { data, error } = await supabase.rpc("check_in_via_geofence", {
        p_rsvp_id: rsvpId,
        p_latitude: latitude,
        p_longitude: longitude,
        p_accuracy_meters: accuracy,
      });

      if (error) {
        const geofencingDisabled = error.hint === "geofencing_disabled";
        const message = geofencingDisabled
          ? "This event doesn't use GPS check-in. Please check in with an organizer at the venue."
          : error.message || "Check-in failed. Please try again.";
        const finalResult: GeofenceCheckInResult = {
          status: "error",
          errorMessage: message,
          geofencingDisabled,
        };
        setResult(finalResult);
        return finalResult;
      }

      const payload = data as {
        success: boolean;
        already_checked_in?: boolean;
        reason?: string;
        distance_meters?: number;
        radius_meters?: number;
      } | null;

      if (!payload) {
        const finalResult: GeofenceCheckInResult = {
          status: "error",
          errorMessage: "Check-in failed. Please try again.",
        };
        setResult(finalResult);
        return finalResult;
      }

      if (payload.already_checked_in) {
        const finalResult: GeofenceCheckInResult = { status: "already_checked_in" };
        setResult(finalResult);
        return finalResult;
      }

      if (!payload.success && payload.reason === "too_far") {
        const finalResult: GeofenceCheckInResult = {
          status: "too_far",
          distanceMeters: payload.distance_meters,
          radiusMeters: payload.radius_meters,
          accuracyMeters: accuracy,
          errorMessage: lowAccuracy
            ? `You're about ${Math.round(payload.distance_meters ?? 0)}m from the event (need to be within ${payload.radius_meters}m). Your GPS accuracy is low right now (±${Math.round(accuracy)}m) — try moving to a spot with a clearer sky view.`
            : `You're about ${Math.round(payload.distance_meters ?? 0)}m from the event. You need to be within ${payload.radius_meters}m to check in.`,
        };
        setResult(finalResult);
        return finalResult;
      }

      const finalResult: GeofenceCheckInResult = {
        status: "success",
        distanceMeters: payload.distance_meters,
        radiusMeters: payload.radius_meters,
        accuracyMeters: accuracy,
      };
      setResult(finalResult);
      return finalResult;
    },
    [supabase],
  );

  const reset = useCallback(() => setResult({ status: "idle" }), []);

  return { ...result, checkIn, reset };
}
