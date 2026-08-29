/**
 * AccessibilityRoutePanel (Issue #4150).
 *
 * UI for the "Accessibility Optimized Route": pick an origin/destination,
 * flip the wheelchair-accessible toggle (mirrors
 * `profiles.requires_wheelchair_access`) and see the recalculated route
 * plus which hazards or broken facilities the router worked around.
 */

import { useMemo, useState } from "react";
import { Accessibility, AlertTriangle, Route as RouteIcon } from "lucide-react";
import {
  buildCampusGraph,
  getAccessibilityOptimizedRoute,
  type CampusFacilityOutage,
} from "@/services/accessibilityRouteService";

export interface AccessibilityRoutePanelProps {
  /** Crowdsourced facility outages (e.g. a broken elevator). */
  outages?: CampusFacilityOutage[];
  /** Seed value for the wheelchair toggle. */
  initialWheelchairRequired?: boolean;
}

const formatMeters = (meters: number): string =>
  Number.isFinite(meters) ? `${Math.round(meters)} m` : "—";

export function AccessibilityRoutePanel({
  outages = [],
  initialWheelchairRequired = false,
}: AccessibilityRoutePanelProps) {
  const nodes = useMemo(() => Object.values(buildCampusGraph().nodes), []);
  const [fromNodeId, setFromNodeId] = useState("library");
  const [toNodeId, setToNodeId] = useState("labTower");
  const [wheelchairRequired, setWheelchairRequired] = useState(
    initialWheelchairRequired,
  );

  const route = useMemo(
    () =>
      getAccessibilityOptimizedRoute({
        fromNodeId,
        toNodeId,
        wheelchairRequired,
        outages,
      }),
    [fromNodeId, toNodeId, wheelchairRequired, outages],
  );

  return (
    <section
      aria-label="Accessibility Optimized Route"
      className="bg-background/95 backdrop-blur border border-border rounded-md p-4 flex flex-col gap-3 text-sm"
    >
      <header className="flex items-center gap-2">
        <Accessibility className="w-5 h-5" aria-hidden="true" />
        <h2 className="font-medium">Campus routing</h2>
      </header>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="a11y-route-from">
          Origin
        </label>
        <select
          id="a11y-route-from"
          className="border border-border rounded-sm px-2 py-1 bg-background"
          value={fromNodeId}
          onChange={(event) => setFromNodeId(event.target.value)}
        >
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.id}
            </option>
          ))}
        </select>

        <span aria-hidden="true">→</span>

        <label className="sr-only" htmlFor="a11y-route-to">
          Destination
        </label>
        <select
          id="a11y-route-to"
          className="border border-border rounded-sm px-2 py-1 bg-background"
          value={toNodeId}
          onChange={(event) => setToNodeId(event.target.value)}
        >
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.id}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 select-none">
        <input
          type="checkbox"
          checked={wheelchairRequired}
          onChange={(event) => setWheelchairRequired(event.target.checked)}
          aria-label="Require wheelchair accessible routes"
        />
        Requires wheelchair access
      </label>

      {route.reachable ? (
        <div className="flex flex-col gap-2">
          {route.isAccessibilityOptimized ? (
            <span
              data-testid="a11y-optimized-badge"
              className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium"
            >
              <RouteIcon className="w-3.5 h-3.5" aria-hidden="true" />
              Accessibility Optimized Route
            </span>
          ) : null}

          <p>
            {route.nodeIds.join(" → ")} · {formatMeters(route.totalDistanceMeters)}
          </p>

          {route.hazardsAvoided.length > 0 ? (
            <ul className="list-disc pl-4 text-muted-foreground">
              {route.hazardsAvoided.map((hazard) => (
                <li key={`${hazard.fromNodeId}-${hazard.toNodeId}`}>
                  Avoided steps/incline between {hazard.fromNodeId} and{" "}
                  {hazard.toNodeId}
                </li>
              ))}
            </ul>
          ) : null}

          {route.facilitiesPenalized.length > 0 ? (
            route.effectiveCostMeters > route.totalDistanceMeters ? (
              <p className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                Route passes a facility flagged broken:{" "}
                {route.facilitiesPenalized.join(", ")}
              </p>
            ) : (
              <p className="text-amber-600 dark:text-amber-400">
                Rerouted around broken facilities:{" "}
                {route.facilitiesPenalized.join(", ")}
              </p>
            )
          ) : null}
        </div>
      ) : (
        <p data-testid="a11y-route-unreachable" role="alert">
          No accessible route could be found between these locations.
        </p>
      )}
    </section>
  );
}
