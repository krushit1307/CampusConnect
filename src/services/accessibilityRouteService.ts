/**
 * Accessibility route service (Issue #4150).
 *
 * Owns the campus walkway graph and turns two inputs into a ready-to-render
 * route:
 *
 * 1. The user's accessibility profile (`requires_wheelchair_access`, added
 *    for Issue #4044), and
 * 2. Crowdsourced facility outages ("elevator X is broken"), which penalise
 *    the edges that depend on them so the router finds another entrance.
 *
 * The seeded graph below models a small campus with the situations that
 * matter: a staircase shortcut versus a step-free detour, and a building
 * whose only step-free entry depends on an elevator. Real survey data can
 * replace `buildCampusGraph` without touching the engine or UI.
 */

import {
  computeAccessibleRoute,
  type AccessibilityRoute,
  type FacilityKind,
  type RoutingGraph,
} from "@/lib/accessibility/routingGraph";

/** A facility flagged broken via the crowdsourced reporting API. */
export interface CampusFacilityOutage {
  facilityId: string;
  kind: FacilityKind;
  /** Optional ISO timestamp; reserved for expiry/staleness handling. */
  reportedAt?: string;
}

export interface AccessibilityRouteRequest {
  fromNodeId: string;
  toNodeId: string;
  /** Mirrors `profiles.requires_wheelchair_access`. */
  wheelchairRequired?: boolean;
  outages?: CampusFacilityOutage[];
}

/**
 * Seeded campus walkway graph.
 *
 * Topology (metres are illustrative):
 *
 *   library --steps(40)-- lectureHall      <- naive shortest path
 *   library --plaza(120)-- lectureHall     <- step-free detour
 *   plaza --ramp(60)-- scienceCenter
 *   scienceCenter --elevator(30)-- labTower [facility: elevator-1]
 *   scienceCenter --fireEscape--(steep, 90)-- labTower
 */
export function buildCampusGraph(): RoutingGraph {
  const node = (id: string, lat: number, lng: number) => ({ id, lat, lng });

  return {
    nodes: {
      library: node("library", 28.7041, 77.1025),
      plaza: node("plaza", 28.7045, 77.103),
      lectureHall: node("lectureHall", 28.7049, 77.1035),
      scienceCenter: node("scienceCenter", 28.7052, 77.104),
      labTower: node("labTower", 28.7056, 77.1045),
    },
    edges: [
      { from: "library", to: "lectureHall", distanceMeters: 40, hasSteps: true },
      { from: "library", to: "plaza", distanceMeters: 120 },
      { from: "plaza", to: "lectureHall", distanceMeters: 60 },
      {
        from: "plaza",
        to: "scienceCenter",
        distanceMeters: 60,
        facilityId: "ramp-main",
      },
      {
        from: "scienceCenter",
        to: "labTower",
        distanceMeters: 30,
        facilityId: "elevator-1",
      },
      {
        from: "scienceCenter",
        to: "labTower",
        distanceMeters: 90,
        steepIncline: true,
      },
    ],
  };
}

function outageIds(outages: CampusFacilityOutage[] | undefined): Set<string> {
  return new Set((outages ?? []).map((outage) => outage.facilityId));
}

/**
 * Compute the "Accessibility Optimized Route" for one request.
 *
 * Never throws for bad input: unknown nodes return an unreachable result so
 * the UI can render guidance instead of crashing the map.
 */
export function getAccessibilityOptimizedRoute(
  request: AccessibilityRouteRequest,
): AccessibilityRoute {
  const route = computeAccessibleRoute(
    buildCampusGraph(),
    request.fromNodeId,
    request.toNodeId,
    {
      wheelchairRequired: request.wheelchairRequired === true,
      brokenFacilityIds: outageIds(request.outages),
    },
  );

  return route;
}
