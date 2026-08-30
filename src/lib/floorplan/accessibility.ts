// =============================================================================
// Utility: Accessible Route Planner
// Issue: #4420 - Real-Time "Accessibility Need" Venue Map
// Description: Pure geospatial routing over the feet-based floorplan JSON.
// A wheelchair user needs more than the building name - they need to know
// which entrance has the ramp and how to reach their table without hitting
// stairs or furniture. This module picks the best accessible entry POI,
// projects a street-side start point outside the wall, then strings a
// waypoint path to the target booth, detouring around solid assets with at
// least WHEELCHAIR_CLEARANCE_FT of clearance. Stairs are never used.
// =============================================================================

import { AccessibilityPoi, AccessibilityPoiKind, VenueBounds } from "./types";
import { Point, Rect, inflateRect, segmentRectEntryT } from "./collision";
/** Minimum hallway width (ft) a wheelchair route keeps around obstacles. */
export const WHEELCHAIR_CLEARANCE_FT = 3;

/** How far outside the wall the "from the street" leg starts (ft). */
export const STREET_SETBACK_FT = 8;

/** Safety cap so degenerate layouts can never loop forever. */
export const MAX_DETOUR_WAYPOINTS = 24;

export interface AccessibleRoutePoint {
  x_ft: number;
  y_ft: number;
}

export interface AccessibleRoute {
  /** Polyline in feet: street origin -> entry -> detours -> target. */
  points: AccessibleRoutePoint[];
  entryPoiId: string | null;
  entryKind: AccessibilityPoiKind | null;
  totalDistanceFt: number;
  /** Entrance types intentionally skipped, e.g. ["stairs"]. */
  hazardsAvoided: string[];
}

/** POIs a wheelchair user can actually traverse. */
export function isAccessiblePoi(kind: AccessibilityPoiKind): boolean {
  return kind === "ramp" || kind === "elevator" || kind === "ada_bathroom";
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Street-side origin for an entry POI: pushed straight out beyond the
 * nearest wall by STREET_SETBACK_FT, clamped away from the corners so the
 * polyline visibly starts on the pavement, not inside the building.
 */
export function streetOriginFor(poi: AccessibilityPoi, venue: VenueBounds): AccessibleRoutePoint {
  const x = poi.x_ft;
  const y = poi.y_ft;
  const distances = [
    { side: "left" as const, d: Math.abs(x - 0) },
    { side: "right" as const, d: Math.abs(venue.width_ft - x) },
    { side: "top" as const, d: Math.abs(y - 0) },
    { side: "bottom" as const, d: Math.abs(venue.height_ft - y) },
  ];
  distances.sort((a, b) => a.d - b.d);
  const nearest = distances[0].side;
  const clampAlong = (v: number, span: number) => Math.min(Math.max(v, 2), Math.max(2, span - 2));

  switch (nearest) {
    case "left":
      return { x_ft: -STREET_SETBACK_FT, y_ft: clampAlong(y, venue.height_ft) };
    case "right":
      return { x_ft: venue.width_ft + STREET_SETBACK_FT, y_ft: clampAlong(y, venue.height_ft) };
    case "top":
      return { x_ft: clampAlong(x, venue.width_ft), y_ft: -STREET_SETBACK_FT };
    case "bottom":
    default:
      return { x_ft: clampAlong(x, venue.width_ft), y_ft: venue.height_ft + STREET_SETBACK_FT };
  }
}

/** Solid furniture the route must flow around; exits are doorways, not walls. */
function solidObstacles(
  assets: { id: string; kind: string; x: number; y: number; width: number; height: number }[],
): Rect[] {
  return assets
    .filter((a) => a.kind !== "exit")
    .map((a) => ({ x: a.x, y: a.y, w: a.width, h: a.height }));
}

const CORNER_PAD_FT = 1.5;

/**
 * Greedy string-pulling around axis-aligned obstacles: walk from `start`
 * toward `target`; whenever the straight leg clips an inflated rect, hop to
 * its nearest clear corner and continue. Deterministic and terminating.
 */
function planInteriorWaypoints(
  start: Point,
  target: Point,
  obstacles: Rect[],
): AccessibleRoutePoint[] {
  const path: AccessibleRoutePoint[] = [{ x_ft: start.x, y_ft: start.y }];
  let current: Point = start;
  const tried = new Set<string>();

  for (let i = 0; i < MAX_DETOUR_WAYPOINTS; i++) {
    // Find the obstacle entered first along current -> target.
    let best: { rect: Rect; t: number } | null = null;
    for (const rect of obstacles) {
      const t = segmentRectEntryT(current, target, rect);
      if (t !== null && (best === null || t < best.t)) best = { rect, t };
    }
    if (!best) break; // straight shot is clear

    // Candidate corners just outside the inflated footprint.
    const r = inflateRect(best.rect, CORNER_PAD_FT);
    const candidates: Point[] = [
      { x: r.x, y: r.y },
      { x: r.x + r.w, y: r.y },
      { x: r.x, y: r.y + r.h },
      { x: r.x + r.w, y: r.y + r.h },
    ];
    const fresh = candidates
      .filter((c) => !tried.has(`${c.x},${c.y}`))
      .sort((a, b) => dist(current, a) + dist(a, target) - (dist(current, b) + dist(b, target)));

    if (fresh.length === 0) break; // boxed in; degrade to a direct leg

    const chosen = fresh[0];
    tried.add(`${chosen.x},${chosen.y}`);
    path.push({ x_ft: chosen.x, y_ft: chosen.y });
    current = chosen;
  }

  path.push({ x_ft: target.x, y_ft: target.y });
  return path;
}

function polylineLength(points: AccessibleRoutePoint[]): number {
  const asPt = (p: AccessibleRoutePoint): Point => ({ x: p.x_ft, y: p.y_ft });
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += dist(asPt(points[i - 1]), asPt(points[i]));
  }
  return total;
}

export interface ComputeAccessibleRouteInput {
  venue: VenueBounds;
  /** Target destination center, usually a searched/selected booth (#4420). */
  target: AccessibleRoutePoint;
  /** Id of the target asset so it is not treated as its own obstacle. */
  targetAssetId?: string;
  assets?: { id: string; kind: string; x: number; y: number; width: number; height: number }[];
}

/**
 * Plans the personalized wheelchair route: street -> ramp/elevator ->
 * detoured interior path -> target. Returns null when no accessible entry
 * exists, so callers can show a "not mapped yet" notice instead.
 */
export function computeAccessibleRoute({
  venue,
  target,
  targetAssetId,
  assets = [],
}: ComputeAccessibleRouteInput): AccessibleRoute | null {
  const pois = venue.accessibility_pois ?? [];
  const usable = pois.filter((p) => isAccessiblePoi(p.kind));
  if (usable.length === 0) return null;

  // Keep the goal inside the walls.
  const goal: Point = {
    x: Math.min(Math.max(target.x_ft, 0), venue.width_ft),
    y: Math.min(Math.max(target.y_ft, 0), venue.height_ft),
  };

  const asPoint = (p: AccessibilityPoi): Point => ({ x: p.x_ft, y: p.y_ft });
  const entry = usable.reduce((best, p) =>
    dist(asPoint(p), goal) < dist(asPoint(best), goal) ? p : best,
  );
  const street = streetOriginFor(entry, venue);
  // Obstacles are pre-inflated so every planned leg keeps wheelchair clearance;
  // the destination booth is the goal, not a wall in front of it.
  const obstacles = solidObstacles(assets.filter((a) => a.id !== targetAssetId)).map((r) =>
    inflateRect(r, WHEELCHAIR_CLEARANCE_FT),
  );
  const interior = planInteriorWaypoints(asPoint(entry), goal, obstacles);
  const points: AccessibleRoutePoint[] = [street, ...interior];

  return {
    points,
    entryPoiId: entry.id,
    entryKind: entry.kind,
    totalDistanceFt: Math.round(polylineLength(points) * 10) / 10,
    hazardsAvoided: pois.some((p) => p.kind === "stairs") ? ["stairs"] : [],
  };
}
