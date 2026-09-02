// =============================================================================
// Utility: Floorplan Collision Detection
// Issue: #3675 - Build an 'Interactive "Event Layout" Floorplan Creator'
// Description: Pure geometry helpers. Derives fire-exit clearance pathways
// from the venue definition and flags any asset that intersects them so the
// canvas can paint it red and the editor can surface safety warnings.
// =============================================================================

import { FloorplanAsset, VenueBounds, FireExit, FIRE_EXIT_CLEARANCE_FT } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/** True when two axis-aligned rectangles overlap. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Grows a rectangle outward by `margin` on every side. */
export function inflateRect(r: Rect, margin: number): Rect {
  return { x: r.x - margin, y: r.y - margin, w: r.w + margin * 2, h: r.h + margin * 2 };
}

/**
 * Liang-Barsky clip: where does segment a->b first enter the rect?
 * Returns the entry parameter t in [0,1], or null when the segment misses.
 * Touching the boundary counts as an intersection (conservative for routing).
 */
export function segmentRectEntryT(a: Point, b: Point, rect: Rect): number | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - rect.x, rect.x + rect.w - a.x, a.y - rect.y, rect.y + rect.h - a.y];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1 ? t0 : null;
}

/** True when the segment crosses the rectangle (boundary inclusive). */
export function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean {
  return segmentRectEntryT(a, b, rect) !== null;
}

/**
 * Builds the mandatory clearance rectangle for a fire exit door.
 * The pathway extends FIRE_EXIT_CLEARANCE_FT inward from the door position.
 */
export function fireExitPathway(exit: FireExit, venue: VenueBounds): Rect {
  const c = FIRE_EXIT_CLEARANCE_FT;
  const doorW = 4; // standard 4ft door

  switch (exit.side) {
    case "top":
      return { x: exit.x_ft - doorW / 2, y: 0, w: doorW, h: c };
    case "bottom":
      return { x: exit.x_ft - doorW / 2, y: venue.height_ft - c, w: doorW, h: c };
    case "left":
      return { x: 0, y: exit.y_ft - doorW / 2, w: c, h: doorW };
    case "right":
      return { x: venue.width_ft - c, y: exit.y_ft - doorW / 2, w: c, h: doorW };
  }
}

/** All clearance pathways for a venue. */
export function allFirePathways(venue: VenueBounds): Rect[] {
  return venue.fire_exits.map((e) => fireExitPathway(e, venue));
}

/** Returns the ids of assets that violate a fire-exit clearance pathway. */
export function findCollisions(assets: FloorplanAsset[], venue: VenueBounds): Set<string> {
  const pathways = allFirePathways(venue);
  const colliding = new Set<string>();

  for (const asset of assets) {
    const a: Rect = { x: asset.x, y: asset.y, w: asset.width, h: asset.height };
    if (pathways.some((p) => rectsIntersect(a, p))) colliding.add(asset.id);
  }
  return colliding;
}

/** Clamps an asset so it never leaves the venue outer walls. */
export function clampToVenue(asset: FloorplanAsset, venue: VenueBounds): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, asset.x), Math.max(0, venue.width_ft - asset.width)),
    y: Math.min(Math.max(0, asset.y), Math.max(0, venue.height_ft - asset.height)),
  };
}
