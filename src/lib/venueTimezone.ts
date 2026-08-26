/**
 * src/lib/venueTimezone.ts
 * Issue #3680 — Dynamic "Multi-Campus" Timezone Converter.
 *
 * Frontend-side resolver for the venue's physical IANA timezone. Used
 * as a fallback when the event payload does not already carry
 * `venue_timezone` (e.g. remote/federated events ingested from another
 * CampusConnect instance, or events created before the migration ran).
 *
 * Resolution order (mirrors the SQL trigger):
 *   1. `event.venue_timezone`           — populated by the trigger
 *   2. `event.venues?.timezone`         — joined from the venues table
 *   3. `inferTimezoneFromCoords(lat,lng)` — client-side GPS → IANA tz
 *   4. `'UTC'`                            — last resort
 */

import { areTimeZonesDifferent, getTimeZoneAbbreviation } from "@/lib/timezone";

export interface TimezoneAwareEvent {
  start_date?: string | null;
  end_date?: string | null;
  event_date?: string | null;
  venue_timezone?: string | null;
  venue_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  venues?: { timezone?: string | null } | { timezone?: string | null }[] | null;
}

const CAMPUS_COORD_TZ: ReadonlyArray<{
  lat: number;
  lng: number;
  tz: string;
}> = [
  { lat: 51.5074, lng: -0.1278, tz: "Europe/London" },
  { lat: 40.7128, lng: -74.006, tz: "America/New_York" },
  { lat: 37.7749, lng: -122.4194, tz: "America/Los_Angeles" },
  { lat: 43.6532, lng: -79.3832, tz: "America/Toronto" },
  { lat: 1.3521, lng: 103.8198, tz: "Asia/Singapore" },
  { lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney" },
  { lat: 35.6762, lng: 139.6503, tz: "Asia/Tokyo" },
  { lat: 19.076, lng: 72.8777, tz: "Asia/Kolkata" },
  { lat: 52.52, lng: 13.405, tz: "Europe/Berlin" },
  { lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai" },
];

const EARTH_RADIUS_KM = 6371;
const MATCH_RADIUS_KM = 50;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function inferTimezoneFromCoords(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  if (latitude == null || longitude == null) return null;
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

  let best: { tz: string; dist: number } | null = null;
  for (const c of CAMPUS_COORD_TZ) {
    const dist = haversineKm(latitude, longitude, c.lat, c.lng);
    if (dist <= MATCH_RADIUS_KM && (best === null || dist < best.dist)) {
      best = { tz: c.tz, dist };
    }
  }
  return best?.tz ?? null;
}

export function resolveVenueTimezone(event: TimezoneAwareEvent): string {
  if (event.venue_timezone) return event.venue_timezone;
  const venues = event.venues;
  const joinedTz = Array.isArray(venues)
    ? venues[0]?.timezone
    : venues?.timezone;
  if (joinedTz) return joinedTz;
  const inferred = inferTimezoneFromCoords(event.latitude, event.longitude);
  if (inferred) return inferred;
  return "UTC";
}

export function venueTimezoneLabel(ianaTz: string): string {
  if (!ianaTz) return "UTC";
  const last = ianaTz.split("/").pop() || ianaTz;
  return last.replace(/_/g, " ");
}

export function shouldShowDualClock(
  event: TimezoneAwareEvent,
  userTimeZone: string,
): boolean {
  const venueTz = resolveVenueTimezone(event);
  const startInput = event.start_date || event.event_date;
  if (!startInput) return false;
  return areTimeZonesDifferent(userTimeZone, venueTz, startInput);
}

export function venueTzAbbreviation(
  event: TimezoneAwareEvent,
  atStart: Date | string = new Date(),
): string {
  return getTimeZoneAbbreviation(resolveVenueTimezone(event), atStart);
}
