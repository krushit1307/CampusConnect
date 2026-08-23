/**
 * Accessibility-aware campus routing graph (Issue #4150).
 *
 * A tiny, dependency-free Dijkstra engine that understands mobility
 * constraints. The default "shortest distance" answer is wrong for a
 * student in a wheelchair when it includes a staircase, so edge costs
 * are modified dynamically from two sources:
 *
 * 1. The user's accessibility profile (`wheelchairRequired`) strictly
 *    excludes walkways with steps or steep inclines.
 * 2. Crowdsourced facility outages (e.g. a broken elevator) apply a cost
 *    penalty to the edges that depend on them, which forces the search to
 *    find a different entrance instead of hard-blocking the building.
 *
 * The engine is pure: no network, no clock, fully deterministic. Mapbox /
 * Google Directions constraints can be derived from the same edge flags by
 * future integrations; this module stays the source of truth for what the
 * constraints mean.
 */

/** One walkable point on campus (entrance, junction, building door...). */
export interface RouteNode {
  id: string;
  lat: number;
  lng: number;
}

export type FacilityKind = "elevator" | "ramp" | "accessible_entrance";

/** One directed-but-typically-bidirectional walkway segment. */
export interface RouteEdge {
  /** Id of the node this edge starts at. */
  from: string;
  /** Id of the node this edge ends at. */
  to: string;
  /** Real-world walking distance in metres. */
  distanceMeters: number;
  /** Physical stairs along this segment. Excluded for wheelchair users. */
  hasSteps?: boolean;
  /** Steep incline along this segment. Excluded for wheelchair users. */
  steepIncline?: boolean;
  /**
   * Facility this segment depends on (an elevator shaft, a ramp...). When a
   * crowdsourced outage flags it as broken, its edges are penalised.
   */
  facilityId?: string;
}

export interface RoutingGraph {
  nodes: Record<string, RouteNode>;
  /** Walkways; treated as bidirectional. */
  edges: RouteEdge[];
}

export interface AccessibilityRoutingOptions {
  /**
   * From the user's accessibility profile (Issue #4044). When true, edges
   * tagged `hasSteps` or `steepIncline` are strictly avoided.
   */
  wheelchairRequired?: boolean;
  /**
   * Facility ids currently flagged broken via the crowdsourced API.
   * Edges depending on them remain usable but carry a penalty, mirroring
   * how a real router would demote an edge in the cost graph.
   */
  brokenFacilityIds?: ReadonlySet<string> | readonly string[];
  /**
   * Cost multiplier applied to edges whose facility is broken.
   * Defaults to 4x — enough to reroute when an alternative exists, while
   * still reaching the building when it does not.
   */
  brokenFacilityPenalty?: number;
}

export interface AccessibilityRoute {
  /** False when no compliant path exists between the requested nodes. */
  reachable: boolean;
  /** Ordered node ids from start to end; empty when unreachable. */
  nodeIds: string[];
  totalDistanceMeters: number;
  /**
   * Sum of the costs actually minimised (penalties included), useful for
   * comparing candidate routes in tests and UI copy.
   */
  effectiveCostMeters: number;
  /**
   * Step/incline segments whose endpoints lie on the accessible route —
   * the shortcuts the wheelchair constraint refused and the human-readable
   * reason the route differs from naive shortest-path.
   */
  hazardsAvoided: Array<{ fromNodeId: string; toNodeId: string }>;
  /** Broken facilities whose penalty influenced this search. */
  facilitiesPenalized: string[];
  /** True when any accessibility modifier changed or shaped the route. */
  isAccessibilityOptimized: boolean;
}

const DEFAULT_BROKEN_FACILITY_PENALTY = 4;

interface AdjacentEdge {
  neighborId: string;
  edge: RouteEdge;
}

function normalizeBrokenFacilities(
  brokenFacilityIds: AccessibilityRoutingOptions["brokenFacilityIds"],
): Set<string> {
  return new Set(brokenFacilityIds ?? []);
}

/**
 * Cost of traversing one edge under the given options, plus whether the
 * traversal was penalised. Inaccessible edges report `Infinity` cost so the
 * priority queue naturally skips them.
 */
function edgeCost(
  edge: RouteEdge,
  options: AccessibilityRoutingOptions,
  brokenFacilities: Set<string>,
): { cost: number; penalized: boolean } {
  if (
    options.wheelchairRequired &&
    (edge.hasSteps === true || edge.steepIncline === true)
  ) {
    return { cost: Infinity, penalized: false };
  }

  const penalty =
    edge.facilityId !== undefined && brokenFacilities.has(edge.facilityId)
      ? (options.brokenFacilityPenalty ?? DEFAULT_BROKEN_FACILITY_PENALTY)
      : 1;

  return { cost: edge.distanceMeters * penalty, penalized: penalty > 1 };
}

/** Binary min-heap keyed by accumulated cost; keeps Dijkstra O(E log V). */
class MinHeap {
  private items: Array<{ id: string; cost: number }> = [];

  get size(): number {
    return this.items.length;
  }

  push(id: string, cost: number): void {
    this.items.push({ id, cost });
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].cost <= this.items[index].cost) break;
      [this.items[parent], this.items[index]] = [
        this.items[index],
        this.items[parent],
      ];
      index = parent;
    }
  }

  pop(): { id: string; cost: number } | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (
          left < this.items.length &&
          this.items[left].cost < this.items[smallest].cost
        ) {
          smallest = left;
        }
        if (
          right < this.items.length &&
          this.items[right].cost < this.items[smallest].cost
        ) {
          smallest = right;
        }
        if (smallest === index) break;
        [this.items[smallest], this.items[index]] = [
          this.items[index],
          this.items[smallest],
        ];
        index = smallest;
      }
    }
    return top;
  }
}

function buildAdjacency(
  graph: RoutingGraph,
): Map<string, AdjacentEdge[]> {
  const adjacency = new Map<string, AdjacentEdge[]>();
  const link = (fromId: string, toId: string, edge: RouteEdge) => {
    const list = adjacency.get(fromId);
    if (list) {
      list.push({ neighborId: toId, edge });
    } else {
      adjacency.set(fromId, [{ neighborId: toId, edge }]);
    }
  };

  for (const edge of graph.edges) {
    // Skip dangling edges defensively; a malformed graph must not crash a map.
    if (!graph.nodes[edge.from] || !graph.nodes[edge.to]) continue;
    link(edge.from, edge.to, edge);
    link(edge.to, edge.from, edge);
  }

  return adjacency;
}

interface SearchOutcome {
  reachable: boolean;
  pathNodeIds: string[];
  totalDistanceMeters: number;
  effectiveCostMeters: number;
  /** Broken facilities whose penalty was applied anywhere in the search. */
  penalizedFacilities: Set<string>;
}

/**
 * Standard Dijkstra over the adjacency list, honouring the cost modifiers.
 * Distances accumulate real metres; penalties accumulate separately through
 * the effective cost that the queue minimises.
 */
function runDijkstra(
  adjacency: Map<string, AdjacentEdge[]>,
  startId: string,
  goalId: string,
  options: AccessibilityRoutingOptions,
  brokenFacilities: Set<string>,
): SearchOutcome {
  const bestCost = new Map<string, number>([[startId, 0]]);
  const previous = new Map<string, { nodeId: string; edge: RouteEdge; penalized: boolean }>();
  const settled = new Set<string>();
  const penalizedFacilities = new Set<string>();
  const heap = new MinHeap();
  heap.push(startId, 0);

  while (heap.size > 0) {
    const current = heap.pop();
    if (!current) break;
    if (settled.has(current.id)) continue;
    settled.add(current.id);

    if (current.id === goalId) break;

    for (const adjacent of adjacency.get(current.id) ?? []) {
      if (settled.has(adjacent.neighborId)) continue;
      const { cost, penalized } = edgeCost(adjacent.edge, options, brokenFacilities);
      if (!Number.isFinite(cost)) continue;
      if (penalized && adjacent.edge.facilityId !== undefined) {
        // The outage influenced this search even when the edge does not end
        // up on the winning path — that is exactly what the UI reports.
        penalizedFacilities.add(adjacent.edge.facilityId);
      }

      const nextCost = current.cost + cost;
      const knownCost = bestCost.get(adjacent.neighborId);
      if (knownCost === undefined || nextCost < knownCost) {
        bestCost.set(adjacent.neighborId, nextCost);
        previous.set(adjacent.neighborId, {
          nodeId: current.id,
          edge: adjacent.edge,
          penalized,
        });
        heap.push(adjacent.neighborId, nextCost);
      }
    }
  }

  if (!bestCost.has(goalId) || !settled.has(goalId)) {
    return {
      reachable: false,
      pathNodeIds: [],
      totalDistanceMeters: 0,
      effectiveCostMeters: Infinity,
      penalizedFacilities,
    };
  }

  // Walk parents back to the start, collecting real metres + penalties.
  const pathNodeIds: string[] = [];
  let cursor = goalId;
  let effectiveCostMeters = 0;
  let totalDistanceMeters = 0;

  while (cursor !== startId) {
    const step = previous.get(cursor);
    if (!step) break; // Defensive: cannot happen once settled.
    pathNodeIds.unshift(cursor);
    effectiveCostMeters += step.edge.distanceMeters * (step.penalized
      ? (options.brokenFacilityPenalty ?? DEFAULT_BROKEN_FACILITY_PENALTY)
      : 1);
    totalDistanceMeters += step.edge.distanceMeters;
    cursor = step.nodeId;
  }
  pathNodeIds.unshift(startId);

  return {
    reachable: true,
    pathNodeIds,
    totalDistanceMeters,
    effectiveCostMeters,
    penalizedFacilities,
  };
}

/**
 * Hazardous segments (steps / steep inclines) whose two endpoints both lie
 * on the accessible route — the shortcuts the constraint refused, which is
 * the human-readable reason the route differs from naive shortest-path.
 */
function findHazardShortcuts(
  graph: RoutingGraph,
  pathNodeIds: string[],
): Array<{ fromNodeId: string; toNodeId: string }> {
  const onPath = new Set(pathNodeIds);
  const hazards: Array<{ fromNodeId: string; toNodeId: string }> = [];

  for (const edge of graph.edges) {
    if (!(edge.hasSteps || edge.steepIncline)) continue;
    if (onPath.has(edge.from) && onPath.has(edge.to)) {
      hazards.push({ fromNodeId: edge.from, toNodeId: edge.to });
    }
  }

  return hazards.sort((a, b) =>
    a.fromNodeId.localeCompare(b.fromNodeId) ||
    a.toNodeId.localeCompare(b.toNodeId),
  );
}

/**
 * Compute the best route between two nodes under accessibility constraints.
 *
 * Returns `reachable: false` when either endpoint is unknown or no
 * constraint-compliant path exists — callers should show guidance UI rather
 * than a broken map.
 */
export function computeAccessibleRoute(
  graph: RoutingGraph,
  startId: string,
  goalId: string,
  options: AccessibilityRoutingOptions = {},
): AccessibilityRoute {
  const empty: AccessibilityRoute = {
    reachable: false,
    nodeIds: [],
    totalDistanceMeters: 0,
    effectiveCostMeters: Infinity,
    hazardsAvoided: [],
    facilitiesPenalized: [],
    isAccessibilityOptimized: Boolean(options.wheelchairRequired),
  };

  if (!graph.nodes[startId] || !graph.nodes[goalId]) {
    return empty;
  }

  const brokenFacilities = normalizeBrokenFacilities(options.brokenFacilityIds);
  const outcome = runDijkstra(
    buildAdjacency(graph),
    startId,
    goalId,
    options,
    brokenFacilities,
  );

  if (!outcome.reachable) {
    return empty;
  }

  const hazardsAvoided =
    options.wheelchairRequired && startId !== goalId
      ? findHazardShortcuts(graph, outcome.pathNodeIds)
      : [];

  return {
    reachable: true,
    nodeIds: outcome.pathNodeIds,
    totalDistanceMeters: Math.round(outcome.totalDistanceMeters * 100) / 100,
    effectiveCostMeters:
      outcome.effectiveCostMeters === Infinity
        ? Infinity
        : Math.round(outcome.effectiveCostMeters * 100) / 100,
    hazardsAvoided,
    facilitiesPenalized: [...outcome.penalizedFacilities].sort(),
    isAccessibilityOptimized:
      Boolean(options.wheelchairRequired) ||
      outcome.penalizedFacilities.size > 0,
  };
}
