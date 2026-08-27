import React, { useState, Suspense, lazy, useMemo } from "react";
import {
  Accessibility,
  Navigation,
  MapPin,
  Loader2,
  AlertTriangle,
  Plus,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAccessibleRoutes, useNearestTransitStops, useVenueEntrances, useAllPathways, useAccessibilityStats } from "@/hooks/useAccessibleRoutes";
import AccessibilityRoutePanel from "./AccessibilityRoutePanel";
import { PathwaySubmitForm, ReportIssueForm } from "./PathwaySubmitForm";

const AccessibleRouteLeaflet = lazy(() => import("./AccessibleRouteLeaflet"));

// ─── Props ──────────────────────────────────────────────────────────────

interface AccessibilityRouteMapperProps {
  venueId?: string;
  venueName?: string;
  eventLatitude?: number | null;
  eventLongitude?: number | null;
}

// ─── Stats Badge ────────────────────────────────────────────────────────

function StatsBadge({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
      {icon}
      <span className="font-bold">{value}</span>
      <span>{label}</span>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────

export function AccessibilityRouteMapper({
  venueId,
  venueName,
  eventLatitude,
  eventLongitude,
}: AccessibilityRouteMapperProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showPathways, setShowPathways] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showObstacles, setShowObstacles] = useState(true);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  // Determine nearest venue entrance from event coordinates
  const { data: entrances, isLoading: entrancesLoading } = useVenueEntrances(venueId);
  const nearestEntrance = useMemo(() => {
    if (!entrances || entrances.length === 0) return null;
    if (!eventLatitude || !eventLongitude) return entrances[0];
    let closest = entrances[0];
    let minDist = Infinity;
    for (const e of entrances) {
      const d = Math.hypot(
        e.position.lat - eventLatitude,
        e.position.lng - eventLongitude,
      );
      if (d < minDist) {
        minDist = d;
        closest = e;
      }
    }
    return closest;
  }, [entrances, eventLatitude, eventLongitude]);

  // Fetch routes for the nearest venue entrance
  const { data: routes, isLoading: routesLoading } = useAccessibleRoutes(
    nearestEntrance?.id || null,
  );

  // Fetch nearest transit stops from event location
  const { data: transitStops, isLoading: transitLoading } = useNearestTransitStops(
    eventLatitude || null,
    eventLongitude || null,
    10,
  );

  // Fetch all pathways for background display
  const { data: allPathways } = useAllPathways();

  // Fetch stats
  const { data: stats } = useAccessibilityStats();

  const isLoading = entrancesLoading || routesLoading || transitLoading;

  return (
    <section
      className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden"
      aria-label="Accessibility Route Mapper"
      role="region"
    >
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-900/50 border border-violet-800 rounded-lg flex items-center justify-center">
            <Accessibility className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Accessibility Route Mapper
              <span className="text-[9px] px-1.5 py-0.5 bg-violet-900/50 text-violet-400 border border-violet-800 rounded-full font-bold">
                BETA
              </span>
            </h2>
            <p className="text-[10px] text-slate-500">
              {venueName
                ? `Accessible routes to ${venueName}`
                : "Find wheelchair-accessible paths to this venue"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[10px] text-slate-400 hover:text-white transition-colors"
              aria-expanded={showStats}
            >
              <BarChart3 className="w-3 h-3" />
              Stats
              {showStats ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={() => setShowSubmitForm(!showSubmitForm)}
            className="flex items-center gap-1 px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10px] font-bold transition-colors"
            aria-expanded={showSubmitForm}
          >
            <Plus className="w-3 h-3" />
            {showSubmitForm ? "Close" : "Submit Pathway"}
          </button>
        </div>
      </div>

      {/* Stats Panel */}
      {showStats && stats && (
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{stats.totalPathways}</div>
              <div className="text-[9px] text-slate-500 uppercase">Pathways</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{stats.totalRoutes}</div>
              <div className="text-[9px] text-slate-500 uppercase">Routes</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-400">
                {stats.wheelchairCoveragePercent.toFixed(0)}%
              </div>
              <div className="text-[9px] text-slate-500 uppercase">Wheelchair Coverage</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-400">{stats.pendingReports}</div>
              <div className="text-[9px] text-slate-500 uppercase">Pending Reports</div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Pathway Form */}
      {showSubmitForm && (
        <div className="p-4 border-b border-slate-800">
          <PathwaySubmitForm
            onClose={() => setShowSubmitForm(false)}
            defaultStartLat={eventLatitude || undefined}
            defaultStartLng={eventLongitude || undefined}
          />
        </div>
      )}

      {/* Report Issue Form */}
      {showReportForm && (
        <div className="p-4 border-b border-slate-800">
          <ReportIssueForm
            routeId={showReportForm}
            onClose={() => setShowReportForm(null)}
          />
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="px-4 py-12 text-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading accessible routes...</p>
          <p className="text-[11px] text-slate-600 mt-1">
            Querying pathway database and transit stops
          </p>
        </div>
      )}

      {/* No Routes State */}
      {!isLoading && routes && routes.length === 0 && (
        <div className="px-4 py-8 text-center">
          <Navigation className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">
            No accessible routes found
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
            No wheelchair-accessible pathways have been mapped for this venue
            yet. Click "Submit Pathway" to help the community by adding one.
          </p>
        </div>
      )}

      {/* Map + Panel Layout */}
      {!isLoading && routes && routes.length > 0 && transitStops && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
          {/* Leaflet Map (3/5 width on large screens) */}
          <div className="lg:col-span-3 p-2">
            <Suspense
              fallback={
                <div className="h-[500px] bg-slate-900 rounded-xl flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                </div>
              }
            >
              <AccessibleRouteLeaflet
                routes={routes}
                pathways={allPathways || []}
                transitStops={transitStops}
                venueEntrances={entrances || []}
                selectedRouteId={selectedRouteId}
                onSelectRoute={setSelectedRouteId}
                showPathways={showPathways}
                showFacilities={showFacilities}
                showObstacles={showObstacles}
              />
            </Suspense>
          </div>

          {/* Route Panel (2/5 width on large screens) */}
          <div className="lg:col-span-2 p-2 max-h-[600px] overflow-y-auto">
            <AccessibilityRoutePanel
              routes={routes}
              selectedRouteId={selectedRouteId}
              onSelectRoute={setSelectedRouteId}
              onReportIssue={(routeId) => setShowReportForm(routeId)}
            />
          </div>
        </div>
      )}

      {/* Map Layer Controls */}
      {!isLoading && routes && routes.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800 flex items-center gap-4 flex-wrap">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Layers:</span>
          {[
            { key: "pathways", label: "All Pathways", state: showPathways, setter: setShowPathways },
            { key: "facilities", label: "Facilities", state: showFacilities, setter: setShowFacilities },
            { key: "obstacles", label: "Obstacles", state: showObstacles, setter: setShowObstacles },
          ].map((layer) => (
            <label
              key={layer.key}
              className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer hover:text-white transition-colors"
            >
              <input
                type="checkbox"
                checked={layer.state}
                onChange={(e) => layer.setter(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${
                  layer.state
                    ? "bg-violet-600 border-violet-500"
                    : "border-slate-600"
                }`}
              >
                {layer.state && (
                  <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              {layer.label}
            </label>
          ))}
          {stats && (
            <div className="ml-auto flex items-center gap-3">
              <StatsBadge
                label="pathways"
                value={stats.verifiedPathways}
                icon={<MapPin className="w-3 h-3" />}
              />
              <StatsBadge
                label="avg rating"
                value={stats.averageRouteRating.toFixed(1)}
                icon={<span className="text-amber-400">★</span>}
              />
            </div>
          )}
        </div>
      )}

      {/* Accessibility Screen Reader Info */}
      <div className="sr-only" role="status" aria-live="polite">
        {routes && routes.length > 0 && (
          <span>
            {routes.length} accessible route{routes.length !== 1 ? "s" : ""} found
            {selectedRouteId && (
              <> — Currently viewing route: {routes.find((r) => r.id === selectedRouteId)?.name}</>
            )}
          </span>
        )}
      </div>
    </section>
  );
}

export default AccessibilityRouteMapper;
