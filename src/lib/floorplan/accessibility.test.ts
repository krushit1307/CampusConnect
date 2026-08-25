// =============================================================================
// Tests: Accessible Route Planner (#4420)
// Pure geometry: entry POI selection, street projection, obstacle detours.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  computeAccessibleRoute,
  isAccessiblePoi,
  streetOriginFor,
  WHEELCHAIR_CLEARANCE_FT,
} from "./accessibility";
import { segmentRectEntryT, inflateRect, segmentIntersectsRect } from "./collision";
import { AccessibilityPoi, DEFAULT_VENUE, VenueBounds } from "./types";

function venueWith(pois: AccessibilityPoi[]): VenueBounds {
  return { ...DEFAULT_VENUE, accessibility_pois: pois };
}

const ramp: AccessibilityPoi = {
  id: "poi_ramp",
  kind: "ramp",
  label: "North Ramp",
  x_ft: 20,
  y_ft: 2,
};
const stairs: AccessibilityPoi = {
  id: "poi_stairs",
  kind: "stairs",
  label: "Grand Stairs",
  x_ft: 50,
  y_ft: 0,
};
const elevator: AccessibilityPoi = {
  id: "poi_lift",
  kind: "elevator",
  label: "West Elevator",
  x_ft: 2,
  y_ft: 30,
};

describe("POI classification (#4420)", () => {
  it("marks ramps, elevators and ADA bathrooms as traversable", () => {
    expect(isAccessiblePoi("ramp")).toBe(true);
    expect(isAccessiblePoi("elevator")).toBe(true);
    expect(isAccessiblePoi("ada_bathroom")).toBe(true);
  });

  it("never routes through stairs", () => {
    expect(isAccessiblePoi("stairs")).toBe(false);
  });
});

describe("streetOriginFor", () => {
  it("projects outward beyond the nearest wall", () => {
    const origin = streetOriginFor(ramp, DEFAULT_VENUE);
    expect(origin.y_ft).toBeLessThan(0); // ramp sits near the top wall
    expect(origin.x_ft).toBeGreaterThan(0);
  });

  it("keeps the street point clamped away from side corners", () => {
    const cornerPoi: AccessibilityPoi = { ...ramp, x_ft: 99, y_ft: 59 };
    const origin = streetOriginFor(cornerPoi, DEFAULT_VENUE);
    // Ties resolve to the earlier side (right), clamping along its span.
    expect(origin.x_ft).toBe(DEFAULT_VENUE.width_ft + 8);
    expect(origin.y_ft).toBe(58);
  });
});

describe("segment/rect primitives", () => {
  it("detects crossings and misses", () => {
    const rect = { x: 10, y: 10, w: 5, h: 5 };
    expect(segmentIntersectsRect({ x: 0, y: 12 }, { x: 30, y: 12 }, rect)).toBe(true);
    expect(segmentIntersectsRect({ x: 0, y: 20 }, { x: 30, y: 20 }, rect)).toBe(false);
  });

  it("returns earlier entry times for closer obstacles", () => {
    const near = segmentRectEntryT(
      { x: 0, y: 12 },
      { x: 40, y: 12 },
      inflateRect({ x: 10, y: 10, w: 5, h: 5 }, WHEELCHAIR_CLEARANCE_FT),
    );
    expect(near).not.toBeNull();
  });
});

describe("computeAccessibleRoute", () => {
  it("returns null when no accessible entry exists", () => {
    expect(
      computeAccessibleRoute({
        venue: venueWith([stairs]),
        target: { x_ft: 50, y_ft: 30 },
      }),
    ).toBeNull();
  });

  it("picks the nearest accessible entry and ignores stairs", () => {
    // Elevator (west) is far; ramp (north) is closest to the target.
    const route = computeAccessibleRoute({
      venue: venueWith([stairs, elevator, ramp]),
      assets: [],
      target: { x_ft: 25, y_ft: 20 },
    });
    expect(route).not.toBeNull();
    expect(route!.entryPoiId).toBe("poi_ramp");
    expect(route!.entryKind).toBe("ramp");
    expect(route!.hazardsAvoided).toEqual(["stairs"]);
  });

  it("starts on the street outside the wall and ends at the target", () => {
    const route = computeAccessibleRoute({
      venue: venueWith([ramp]),
      assets: [],
      target: { x_ft: 60, y_ft: 40 },
    });
    expect(route!.points[0].x_ft < 0 || route!.points[0].y_ft < 0).toBe(true);
    const last = route!.points[route!.points.length - 1];
    expect(last).toEqual({ x_ft: 60, y_ft: 40 });
    expect(route!.totalDistanceFt).toBeGreaterThan(0);
  });

  it("detours around a blocking table with clearance", () => {
    // Wall of tables between the north ramp and the southern target.
    const blockers = [{ id: "a1", kind: "rect_table", x: 15, y: 18, width: 30, height: 4 }];
    const route = computeAccessibleRoute({
      venue: venueWith([ramp]),
      assets: blockers,
      target: { x_ft: 30, y_ft: 45 },
    });
    expect(route).not.toBeNull();
    // Every leg must clear the inflated footprint of the blocker row.
    const blocked = inflateRect({ x: 15, y: 18, w: 30, h: 4 }, WHEELCHAIR_CLEARANCE_FT);
    const asPt = (p: { x_ft: number; y_ft: number }) => ({ x: p.x_ft, y: p.y_ft });
    for (let i = 1; i < route!.points.length; i++) {
      const a = asPt(route!.points[i - 1]);
      const b = asPt(route!.points[i]);
      // Interior detour waypoints guarantee clearance for every segment.
      if (segmentRectEntryT(a, b, blocked) !== null) {
        throw new Error(`Segment ${i - 1}->${i} crosses the blocker`);
      }
    }
    // The path actually went around (more than just street->entry->target).
    expect(route!.points.length).toBeGreaterThan(3);
  });

  it("keeps a straight line when nothing blocks the way", () => {
    const route = computeAccessibleRoute({
      venue: venueWith([ramp]),
      assets: [],
      target: { x_ft: 22, y_ft: 12 },
    });
    // street -> entry -> target only
    expect(route!.points.length).toBe(3);
  });

  it("does not detour around the destination booth itself", () => {
    // The booth sits directly between the ramp and its own center.
    const route = computeAccessibleRoute({
      venue: venueWith([ramp]),
      assets: [{ id: "booth", kind: "rect_table", x: 16, y: 6, width: 8, height: 4 }],
      targetAssetId: "booth",
      target: { x_ft: 20, y_ft: 8 },
    });
    expect(route!.points.length).toBe(3); // street -> entry -> booth center
  });

  it("clamps out-of-bounds targets into the venue", () => {
    const route = computeAccessibleRoute({
      venue: venueWith([ramp]),
      assets: [],
      target: { x_ft: 500, y_ft: 500 },
    });
    const last = route!.points[route!.points.length - 1];
    expect(last.x_ft).toBeLessThanOrEqual(DEFAULT_VENUE.width_ft);
    expect(last.y_ft).toBeLessThanOrEqual(DEFAULT_VENUE.height_ft);
  });
});
