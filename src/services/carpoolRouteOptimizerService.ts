/**
 * Module: Dynamic "Carpool" Route Optimizer
 * File: src/services/carpoolRouteOptimizerService.ts
 * Issue: #4412
 *
 * Matchmaking (#4251 / #2877) groups a driver with up to 3 riders, but the
 * driver still has no idea which dorm to hit first - leading to 45-minute
 * detours around campus. This module closes that gap:
 *
 *   1. Once a carpool group is finalized, gather GPS coordinates for the
 *      riders' pickup spots and the final event venue.
 *   2. Ask the Google Maps Directions API for the optimal multi-stop route
 *      (`waypoints=optimize:true|...`). If no API key is configured or the
 *      call fails, fall back to an offline nearest-neighbour + 2-opt
 *      heuristic so drivers always get a sane order.
 *   3. Parse the optimized waypoint order back into labelled steps
 *      ("Stop 1: Alice (North Hall) ... Final Destination: Ski Resort").
 *   4. Produce 1-click deep links to hand the route to Google Maps or
 *      Apple Maps for turn-by-turn navigation.
 *
 * All network access is injected so the whole optimize -> parse -> deeplink
 * pipeline is unit-testable without calling Google.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface LabeledGeoPoint extends GeoPoint {
  label: string;
}

export interface RouteStop extends LabeledGeoPoint {
  id: string;
  /** Rider display name when the stop is a person's pickup. */
  riderName?: string;
}

export interface CarpoolRouteGroup {
  carpoolId: string;
  /** Where the driver starts (e.g. their dorm). */
  origin: LabeledGeoPoint;
  /** The final event venue. */
  destination: LabeledGeoPoint;
  /** Rider pickups, unordered as they come out of matchmaking. */
  stops: RouteStop[];
}

export type RouteProvider = "google" | "heuristic";

export interface OptimizedLeg {
  fromLabel: string;
  toLabel: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface OptimizedRoute {
  provider: RouteProvider;
  /** Stops in pickup order. */
  orderedStops: RouteStop[];
  legs: OptimizedLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  overviewPolyline: string | null;
}

export class DirectionsApiError extends Error {
  constructor(
    message: string,
    public readonly apiStatus?: string,
  ) {
    super(message);
    this.name = "DirectionsApiError";
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance between two coordinates, in meters. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---------------------------------------------------------------------------
// Offline fallback optimizer (nearest neighbour + 2-opt)
// ---------------------------------------------------------------------------

function pathDistance(origin: GeoPoint, ordered: RouteStop[], destination: GeoPoint): number {
  let total = 0;
  let cursor: GeoPoint = origin;
  for (const stop of ordered) {
    total += haversineMeters(cursor, stop);
    cursor = stop;
  }
  return total + haversineMeters(cursor, destination);
}

/**
 * Deterministic TSP-ish ordering: greedy nearest neighbour seeded from the
 * driver's start, improved with a bounded 2-opt pass. Good enough for the
 * 1-3 pickups a carpool actually has, and free when Google is not wired up.
 */
export function optimizeStopOrder(
  origin: GeoPoint,
  destination: GeoPoint,
  stops: RouteStop[],
): RouteStop[] {
  if (stops.length <= 1) return [...stops];

  // Greedy nearest neighbour.
  const remaining = [...stops];
  const ordered: RouteStop[] = [];
  let cursor: GeoPoint = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((stop, idx) => {
      const dist = haversineMeters(cursor, stop);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next);
    cursor = next;
  }

  // 2-opt improvement pass.
  let best = ordered;
  let bestLen = pathDistance(origin, best, destination);
  let improved = true;
  let guard = 0;
  while (improved && guard < 50) {
    improved = false;
    guard += 1;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const len = pathDistance(origin, candidate, destination);
        if (len < bestLen - 0.01) {
          best = candidate;
          bestLen = len;
          improved = true;
        }
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Google Maps Directions API integration
// ---------------------------------------------------------------------------

const DIRECTIONS_ENDPOINT = "https://maps.googleapis.com/maps/api/directions/json";

function formatCoord(point: GeoPoint): string {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

/**
 * Builds the Directions API request URL. The magic is `optimize:true` inside
 * the waypoints parameter - Google then returns a `waypoint_order` describing
 * the fastest sequence for the driver.
 */
export function buildDirectionsUrl(group: CarpoolRouteGroup, apiKey: string): string {
  const params = new URLSearchParams({
    origin: formatCoord(group.origin),
    destination: formatCoord(group.destination),
    mode: "driving",
    key: apiKey,
  });
  const waypoints = ["optimize:true", ...group.stops.map(formatCoord)].join("|");
  params.set("waypoints", waypoints);
  return `${DIRECTIONS_ENDPOINT}?${params.toString()}`;
}

interface DirectionsApiResponse {
  status?: string;
  error_message?: string;
  routes?: Array<{
    overview_polyline?: { points?: string };
    waypoint_order?: number[];
    legs?: Array<{
      distance?: { value?: number };
      duration?: { value?: number };
    }>;
  }>;
}

/**
 * Parses a successful Directions API response into our OptimizedRoute,
 * re-applying Google's waypoint_order to the original stop list and building
 * human-readable legs ("Stop 1: Alice (North Hall)" -> "Stop 2: Bob (...)").
 */
export function parseDirectionsResponse(raw: unknown, group: CarpoolRouteGroup): OptimizedRoute {
  const response = raw as DirectionsApiResponse;
  if (!response || response.status !== "OK" || !response.routes?.length) {
    throw new DirectionsApiError(
      response?.error_message || "Google Directions API did not return a route.",
      response?.status,
    );
  }

  const route = response.routes[0];
  // Google returns waypoint_order when optimizing; if it's missing or the
  // wrong length, fall back to the original matchmaking order.
  const waypointOrder =
    route.waypoint_order && route.waypoint_order.length === group.stops.length
      ? route.waypoint_order
      : group.stops.map((_, idx) => idx);
  const orderedStops: RouteStop[] = waypointOrder.map((idx) => group.stops[idx]);

  const legLabels = [
    group.origin.label,
    ...orderedStops.map((s) => s.label),
    group.destination.label,
  ];
  const legs: OptimizedLeg[] = (route.legs ?? []).map((leg, idx) => ({
    fromLabel: legLabels[idx] ?? `Stop ${idx}`,
    toLabel: legLabels[idx + 1] ?? "Destination",
    distanceMeters: leg.distance?.value ?? 0,
    durationSeconds: leg.duration?.value ?? 0,
  }));

  return {
    provider: "google",
    orderedStops,
    legs,
    totalDistanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
    totalDurationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    overviewPolyline: route.overview_polyline?.points ?? null,
  };
}

// ---------------------------------------------------------------------------
// Heuristic route construction (used when Google is unavailable)
// ---------------------------------------------------------------------------

const HEURISTIC_SPEED_MPS = 11; // ~40 km/h campus driving average.

export function buildHeuristicRoute(group: CarpoolRouteGroup): OptimizedRoute {
  const orderedStops = optimizeStopOrder(group.origin, group.destination, group.stops);

  const points: Array<LabeledGeoPoint> = [group.origin, ...orderedStops, group.destination];
  const legs: OptimizedLeg[] = [];
  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const distance = haversineMeters(points[i], points[i + 1]);
    totalDistance += distance;
    legs.push({
      fromLabel: points[i].label,
      toLabel: points[i + 1].label,
      distanceMeters: distance,
      durationSeconds: Math.round(distance / HEURISTIC_SPEED_MPS),
    });
  }

  return {
    provider: "heuristic",
    orderedStops,
    legs,
    totalDistanceMeters: totalDistance,
    totalDurationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    overviewPolyline: null,
  };
}

// ---------------------------------------------------------------------------
// Navigation deep links (issue step 5)
// ---------------------------------------------------------------------------

/** 1-click hand-off to Google Maps navigation (supports multi-stop). */
export function buildGoogleMapsDeepLink(
  origin: GeoPoint,
  destination: GeoPoint,
  stops: GeoPoint[] = [],
): string {
  const params = new URLSearchParams({
    api: "1",
    origin: formatCoord(origin),
    destination: formatCoord(destination),
    travelmode: "driving",
  });
  if (stops.length > 0) {
    params.set("waypoints", stops.map(formatCoord).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * 1-click hand-off to Apple Maps. Apple's URL scheme has no multi-stop
 * support, so we navigate straight from the driver's start to the venue -
 * the step list above covers the intermediate pickups.
 */
export function buildAppleMapsDeepLink(origin: GeoPoint, destination: GeoPoint): string {
  const params = new URLSearchParams({
    saddr: formatCoord(origin),
    daddr: formatCoord(destination),
    dirflg: "d",
  });
  return `https://maps.apple.com/?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

type HttpGet = (url: string) => Promise<unknown>;

export interface ResolveOptions {
  /** When absent, the offline heuristic is used directly. */
  apiKey?: string | null;
  httpGet?: HttpGet;
}

/**
 * Full pipeline for issue #4412: try Google's optimized route first, degrade
 * gracefully to the local heuristic. Never throws for missing keys/network -
 * a driver always gets a usable plan back.
 */
export async function resolveOptimizedRoute(
  group: CarpoolRouteGroup,
  options: ResolveOptions = {},
): Promise<{ route: OptimizedRoute; warning: string | null }> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey || group.stops.length === 0) {
    return { route: buildHeuristicRoute(group), warning: null };
  }

  const httpGet: HttpGet = options.httpGet ?? ((url) => fetch(url).then((res) => res.json()));

  try {
    const raw = await httpGet(buildDirectionsUrl(group, apiKey));
    return { route: parseDirectionsResponse(raw, group), warning: null };
  } catch (error) {
    const detail =
      error instanceof DirectionsApiError && error.apiStatus ? ` (${error.apiStatus})` : "";
    return {
      route: buildHeuristicRoute(group),
      warning: `Live traffic optimization unavailable${detail}; showing estimated order.`,
    };
  }
}

/** "Stop 1: Alice (North Hall)" style summary used by the driver UI. */
export function describeStop(position: number, stop: RouteStop): string {
  const where = stop.riderName ? `${stop.riderName} (${stop.label})` : stop.label;
  return `Stop ${position}: ${where}`;
}
