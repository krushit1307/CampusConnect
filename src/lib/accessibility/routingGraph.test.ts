/**
 * Unit tests for the accessibility routing engine (Issue #4150).
 *
 * Covers the three behaviours the issue calls out: naive shortest-path
 * baseline, strict avoidance of stairs/inclines for wheelchair users, and
 * dynamic penalties when a crowdsourced outage flags a facility broken.
 */
import { describe, expect, it } from "vitest";

import {
  computeAccessibleRoute,
  type RoutingGraph,
} from "./routingGraph";
import { getAccessibilityOptimizedRoute } from "@/services/accessibilityRouteService";

/** 5-node graph: steps shortcut vs step-free detour vs penalised elevator. */
function makeGraph(): RoutingGraph {
  return {
    nodes: {
      library: { id: "library", lat: 0, lng: 0 },
      plaza: { id: "plaza", lat: 0, lng: 1 },
      lectureHall: { id: "lectureHall", lat: 0, lng: 2 },
      scienceCenter: { id: "scienceCenter", lat: 1, lng: 1 },
      labTower: { id: "labTower", lat: 2, lng: 1 },
    },
    edges: [
      { from: "library", to: "lectureHall", distanceMeters: 40, hasSteps: true },
      { from: "library", to: "plaza", distanceMeters: 120 },
      { from: "plaza", to: "lectureHall", distanceMeters: 60 },
      { from: "plaza", to: "scienceCenter", distanceMeters: 60 },
      { from: "scienceCenter", to: "labTower", distanceMeters: 30, facilityId: "elevator-1" },
      { from: "scienceCenter", to: "labTower", distanceMeters: 90, steepIncline: true },
    ],
  };
}

describe("computeAccessibleRoute — baseline routing", () => {
  it("finds the shortest path ignoring accessibility by default", () => {
    const route = computeAccessibleRoute(makeGraph(), "library", "labTower");

    expect(route.reachable).toBe(true);
    // 40 (steps) + 60 (plaza→science? no) ... shortest is library→lectureHall
    // via steps then back? No: graph edges are undirected; shortest overall
    // to labTower is library→plaza→scienceCenter→labTower = 120+60+30 = 210
    // OR library→lectureHall(steps)→... lectureHall has no onward edge except
    // plaza/steps, so 40+60+60+30=190 wins.
    expect(route.totalDistanceMeters).toBe(190);
    expect(route.nodeIds).toEqual([
      "library",
      "lectureHall",
      "plaza",
      "scienceCenter",
      "labTower",
    ]);
    expect(route.isAccessibilityOptimized).toBe(false);
  });

  it("returns an unreachable result for unknown nodes", () => {
    const route = computeAccessibleRoute(makeGraph(), "library", "nowhere");

    expect(route.reachable).toBe(false);
    expect(route.nodeIds).toEqual([]);
  });

  it("returns a trivial route for identical endpoints", () => {
    const route = computeAccessibleRoute(makeGraph(), "library", "library");

    expect(route.reachable).toBe(true);
    expect(route.nodeIds).toEqual(["library"]);
    expect(route.totalDistanceMeters).toBe(0);
  });
});

describe("computeAccessibleRoute — wheelchair constraints (#4044 profile)", () => {
  it("strictly avoids stairs and takes the step-free detour", () => {
    const route = computeAccessibleRoute(makeGraph(), "library", "lectureHall", {
      wheelchairRequired: true,
    });

    expect(route.reachable).toBe(true);
    // Steps are 40 m but forbidden; detour is 120+60 = 180 m.
    expect(route.totalDistanceMeters).toBe(180);
    expect(route.nodeIds).toEqual(["library", "plaza", "lectureHall"]);
  });

  it("reports which hazardous segments were avoided", () => {
    const route = computeAccessibleRoute(makeGraph(), "library", "lectureHall", {
      wheelchairRequired: true,
    });

    expect(route.hazardsAvoided).toEqual([
      { fromNodeId: "library", toNodeId: "lectureHall" },
    ]);
    expect(route.isAccessibilityOptimized).toBe(true);
  });

  it("avoids steep inclines as well as steps", () => {
    const route = computeAccessibleRoute(makeGraph(), "scienceCenter", "labTower", {
      wheelchairRequired: true,
    });

    expect(route.reachable).toBe(true);
    // The 90 m steep incline is excluded; only the elevator edge remains.
    expect(route.totalDistanceMeters).toBe(30);
    expect(route.hazardsAvoided).toEqual([
      { fromNodeId: "scienceCenter", toNodeId: "labTower" },
    ]);
  });

  it("reports unreachable when no compliant path exists", () => {
    const graph: RoutingGraph = {
      nodes: {
        a: { id: "a", lat: 0, lng: 0 },
        b: { id: "b", lat: 0, lng: 1 },
      },
      edges: [{ from: "a", to: "b", distanceMeters: 10, hasSteps: true }],
    };

    const accessible = computeAccessibleRoute(graph, "a", "b", {
      wheelchairRequired: true,
    });
    const unrestricted = computeAccessibleRoute(graph, "a", "b");

    expect(accessible.reachable).toBe(false);
    expect(unrestricted.reachable).toBe(true);
  });
});

describe("computeAccessibleRoute — crowdfourced outage penalties", () => {
  it("reroutes around a broken elevator onto the longer entrance", () => {
    const route = computeAccessibleRoute(
      makeGraph(),
      "scienceCenter",
      "labTower",
      { brokenFacilityIds: ["elevator-1"] },
    );

    expect(route.reachable).toBe(true);
    // Elevator edge costs 30*4=120; steep incline costs 90 flat → incline wins.
    expect(route.totalDistanceMeters).toBe(90);
    expect(route.facilitiesPenalized).toContain("elevator-1");
    expect(route.isAccessibilityOptimized).toBe(true);
  });

  it("keeps using the elevator while it is reported healthy", () => {
    const route = computeAccessibleRoute(makeGraph(), "scienceCenter", "labTower");

    expect(route.totalDistanceMeters).toBe(30);
    expect(route.facilitiesPenalized).toEqual([]);
  });

  it("penalises but never silently strands the user", () => {
    // Outages are penalties per #4150 ("forcing the algorithm to find a
    // different building entrance"), not exclusions: even combined with the
    // wheelchair constraint there is always an answer, just a costlier one.
    const strict = computeAccessibleRoute(
      makeGraph(),
      "scienceCenter",
      "labTower",
      { wheelchairRequired: true, brokenFacilityIds: ["elevator-1"] },
    );

    expect(strict.reachable).toBe(true);
    expect(strict.totalDistanceMeters).toBe(30);
    // Effective cost carries the penalty: 30 m * 4.
    expect(strict.effectiveCostMeters).toBe(120);
    expect(strict.facilitiesPenalized).toEqual(["elevator-1"]);

    const flexible = computeAccessibleRoute(
      makeGraph(),
      "scienceCenter",
      "labTower",
      { brokenFacilityIds: ["elevator-1"] },
    );
    expect(flexible.reachable).toBe(true);
  });
});

describe("buildCampusGraph (seeded campus data)", () => {
  it("exposes the documented topology end-to-end", () => {
    const route = getAccessibilityOptimizedRoute({
      fromNodeId: "library",
      toNodeId: "labTower",
      wheelchairRequired: true,
    });

    expect(route.reachable).toBe(true);
    expect(route.nodeIds[0]).toBe("library");
    expect(route.nodeIds[route.nodeIds.length - 1]).toBe("labTower");
    // Must not use the staircase shortcut.
    expect(route.hazardsAvoided.length).toBeGreaterThan(0);
  });

  it("penalises the seeded elevator when flagged broken", () => {
    const healthy = getAccessibilityOptimizedRoute({
      fromNodeId: "scienceCenter",
      toNodeId: "labTower",
    });
    const broken = getAccessibilityOptimizedRoute({
      fromNodeId: "scienceCenter",
      toNodeId: "labTower",
      outages: [{ facilityId: "elevator-1", kind: "elevator" }],
    });

    expect(healthy.totalDistanceMeters).toBeLessThan(broken.totalDistanceMeters);
    expect(broken.facilitiesPenalized).toEqual(["elevator-1"]);
  });
});
