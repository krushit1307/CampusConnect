// =============================================================================
// Component: CarpoolRouteOptimizer
// Issue: #4412 - Dynamic 'Carpool' Route Optimizer
// Description: Driver-facing step-by-step pickup route for a finalized carpool
// group. Shows the optimized stop order ("Stop 1: Alice (North Hall)..."),
// live-vs-estimated badge, totals, and 1-click deep links into Google Maps /
// Apple Maps for turn-by-turn navigation.
// =============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, Clock, Route as RouteIcon, AlertTriangle } from "lucide-react";
import {
  type CarpoolRouteGroup,
  type OptimizedRoute,
  buildAppleMapsDeepLink,
  buildGoogleMapsDeepLink,
  describeStop,
  resolveOptimizedRoute,
} from "../../services/carpoolRouteOptimizerService";

interface CarpoolRouteOptimizerProps {
  group: CarpoolRouteGroup;
  /** Google Maps Directions API key; omit to use the offline heuristic. */
  apiKey?: string | null;
  /** Persist the resolved route for the group's riders. */
  onSaveRoute?: (route: OptimizedRoute) => void | Promise<void>;
}

function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export default function CarpoolRouteOptimizer({
  group,
  apiKey = null,
  onSaveRoute,
}: CarpoolRouteOptimizerProps) {
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);

  // Cumulative arrival offset at each stop, from leg durations.
  const cumulativeSeconds = useMemo(() => {
    if (!route) return [];
    let running = 0;
    return route.legs.map((leg) => {
      running += leg.durationSeconds;
      return running;
    });
  }, [route]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setHasSaved(false);
    resolveOptimizedRoute(group, { apiKey })
      .then(({ route: resolved, warning: warn }) => {
        if (cancelled) return;
        setRoute(resolved);
        setWarning(warn);
        if (onSaveRoute && !warn) {
          Promise.resolve(onSaveRoute(resolved))
            .then(() => setHasSaved(true))
            .catch(() => setHasSaved(false));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    group.carpoolId,
    apiKey,
    JSON.stringify(group.origin),
    JSON.stringify(group.destination),
    JSON.stringify(group.stops),
  ]);

  if (isLoading || !route) {
    return (
      <div
        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 animate-pulse"
        data-testid="route-optimizer-loading"
      >
        <div className="h-5 w-48 bg-slate-800 rounded mb-4"></div>
        <div className="h-16 bg-slate-800 rounded-xl"></div>
      </div>
    );
  }

  const googleLink = buildGoogleMapsDeepLink(group.origin, group.destination, route.orderedStops);
  const appleLink = buildAppleMapsDeepLink(group.origin, group.destination);

  return (
    <section
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl"
      data-testid="route-optimizer"
      aria-label="Optimized pickup route"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-100">
          <Navigation className="w-4 h-4 text-cyan-400" />
          Your Pickup Route
        </h3>
        <span
          data-testid="route-provider-badge"
          className={`text-[11px] px-2.5 py-0.5 rounded-md font-semibold border ${
            route.provider === "google"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-slate-800 text-slate-300 border-slate-700"
          }`}
        >
          {route.provider === "google" ? "Live Traffic Optimized" : "Estimated Order"}
        </span>
      </div>

      {warning && (
        <p
          data-testid="route-warning"
          className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4"
        >
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {warning}
        </p>
      )}

      {/* Step-by-step stops */}
      <ol className="space-y-2 mb-4">
        {route.orderedStops.map((stop, idx) => (
          <li
            key={stop.id}
            data-testid={`route-stop-${idx}`}
            className="flex items-center gap-3 bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3"
          >
            <span className="w-7 h-7 shrink-0 rounded-full bg-cyan-600 text-white text-xs font-black flex items-center justify-center">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-100 truncate">
                {describeStop(idx + 1, stop)}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                ~{formatDuration(cumulativeSeconds[idx] ?? 0)} after departure
              </p>
            </div>
            <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
          </li>
        ))}
        <li
          data-testid="route-final-stop"
          className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3"
        >
          <span className="w-7 h-7 shrink-0 rounded-full bg-emerald-500 text-white text-xs font-black flex items-center justify-center">
            <RouteIcon className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-emerald-300 truncate">
              Final Destination: {group.destination.label}
            </p>
            <p className="text-[11px] text-emerald-400/80 font-mono">
              Total {formatDuration(route.totalDurationSeconds)} ·{" "}
              {formatDistance(route.totalDistanceMeters)}
            </p>
          </div>
          <Clock className="w-4 h-4 text-emerald-400/70 shrink-0" />
        </li>
      </ol>

      {/* Deep links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <a
          href={googleLink}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="route-google-link"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 transition"
        >
          <Navigation className="w-3.5 h-3.5" />
          Open in Google Maps
        </a>
        <a
          href={appleLink}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="route-apple-link"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <MapPin className="w-3.5 h-3.5" />
          Open in Apple Maps
        </a>
      </div>

      {onSaveRoute && (
        <p className="mt-3 text-[11px] text-slate-500 text-center" data-testid="route-save-state">
          {hasSaved
            ? "Route saved - your riders can see the pickup order."
            : "Route not saved yet."}
        </p>
      )}
    </section>
  );
}
