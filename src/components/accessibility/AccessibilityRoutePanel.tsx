import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Navigation,
  Compass,
  Clock,
  MapPin,
  Accessibility,
  AlertTriangle,
  CheckCircle2,
  Star,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Shield,
  Zap,
  Eye,
  Route,
  Flag,
  Info,
  Bus,
  Car,
  Building2,
} from "lucide-react";
import type {
  AccessibleRoute,
  AccessiblePathway,
  PathwayFacility,
  PathwayObstacle,
  RouteTurn,
} from "../../types/accessibility";

// ─── Helpers ────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<
  string,
  { label: string; color: string; bgClass: string; icon: React.ReactNode }
> = {
  easy: {
    label: "Easy",
    color: "#10b981",
    bgClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  moderate: {
    label: "Moderate",
    color: "#f59e0b",
    bgClass: "bg-amber-100 text-amber-800 border-amber-300",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  challenging: {
    label: "Challenging",
    color: "#ef4444",
    bgClass: "bg-red-100 text-red-800 border-red-300",
    icon: <Zap className="w-3 h-3" />,
  },
};

const SURFACE_ICONS: Record<string, string> = {
  paved: "🛣️",
  concrete: "🏗️",
  tile: "🔲",
  gravel: "🪨",
  grass: "🌿",
  carpet: "🟫",
};

const FACILITY_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  ramp: { label: "Wheelchair Ramp", emoji: "♿", color: "text-emerald-600" },
  elevator: { label: "Elevator", emoji: "🛗", color: "text-violet-600" },
  "automatic-door": { label: "Automatic Door", emoji: "🚪", color: "text-blue-600" },
  "tactile-paving": { label: "Tactile Paving", emoji: "🟫", color: "text-amber-600" },
  "rest-area": { label: "Rest Area", emoji: "🪑", color: "text-cyan-600" },
  "accessible-restroom": { label: "Accessible Restroom", emoji: "🚻", color: "text-pink-600" },
};

const OBSTACLE_LABELS: Record<string, { label: string; color: string }> = {
  stairs: { label: "Stairs", color: "text-red-600" },
  curb: { label: "Curb (No Ramp)", color: "text-orange-600" },
  narrow: { label: "Narrow Pathway", color: "text-yellow-600" },
  "steep-grade": { label: "Steep Grade", color: "text-red-700" },
  construction: { label: "Construction Zone", color: "text-amber-600" },
  "door-threshold": { label: "Door Threshold", color: "text-orange-500" },
};

const SEVERITY_CONFIG: Record<string, { label: string; bgClass: string }> = {
  minor: { label: "Minor", bgClass: "bg-yellow-100 text-yellow-800" },
  moderate: { label: "Moderate", bgClass: "bg-amber-100 text-amber-800" },
  severe: { label: "Severe", bgClass: "bg-orange-100 text-orange-800" },
  blocking: { label: "Blocking", bgClass: "bg-red-100 text-red-800" },
};

// ─── Rating Stars ───────────────────────────────────────────────────────

function RatingDisplay({
  rating,
  total,
  size = "sm",
}: {
  rating: number;
  total: number;
  size?: "sm" | "md";
}) {
  const starSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars from ${total} ratings`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${starSize} ${
            i <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-slate-600"
          }`}
        />
      ))}
      <span className="text-[10px] text-slate-400 ml-1">
        {rating.toFixed(1)} ({total})
      </span>
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────

interface AccessibilityRoutePanelProps {
  routes: AccessibleRoute[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  onReportIssue: (routeId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────

const AccessibilityRoutePanel: React.FC<AccessibilityRoutePanelProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  onReportIssue,
}) => {
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [showTurns, setShowTurns] = useState(false);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId),
    [routes, selectedRouteId],
  );

  // Count total facilities/obstacles
  const totalFacilities = useMemo(() => {
    if (!selectedRoute) return 0;
    return selectedRoute.pathways.reduce((sum, pw) => sum + pw.facilities.length, 0);
  }, [selectedRoute]);

  const totalObstacles = useMemo(() => {
    if (!selectedRoute) return 0;
    return selectedRoute.pathways.reduce((sum, pw) => sum + pw.obstacles.length, 0);
  }, [selectedRoute]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Accessibility className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-bold text-white">Accessible Routes</h3>
            <span className="text-[10px] px-2 py-0.5 bg-violet-900/50 text-violet-400 border border-violet-800 rounded-full">
              {routes.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Wheelchair-accessible paths from transit stops to venue entrances
          </p>
        </div>

        <Link
          to="/events/acoustic-wayfinding"
          className="px-2.5 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)]"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" /> LiDAR Acoustic
        </Link>
      </div>

      {/* Route List */}
      <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
        {routes.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Navigation className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No accessible routes found</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Routes will appear once pathways are mapped for this venue
            </p>
          </div>
        )}

        {routes.map((route) => {
          const isSelected = route.id === selectedRouteId;
          const isExpanded = expandedRouteId === route.id;
          const diffConfig = DIFFICULTY_CONFIG[route.difficulty] || DIFFICULTY_CONFIG.moderate;

          return (
            <div
              key={route.id}
              className={`transition-colors ${isSelected ? "bg-violet-950/30" : "bg-transparent"}`}
            >
              {/* Route Card */}
              <button
                onClick={() => onSelectRoute(route.id)}
                className="w-full text-left px-4 py-3 hover:bg-slate-800/50 transition-colors"
                aria-expanded={isExpanded}
                aria-label={`Route: ${route.name}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{route.name}</span>
                      {route.verified && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 border border-emerald-800 rounded-full font-bold flex items-center gap-0.5">
                          <Shield className="w-2.5 h-2.5" />
                          Verified
                        </span>
                      )}
                    </div>

                    {route.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                        {route.description}
                      </p>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Route className="w-3 h-3" />
                        {route.totalDistanceMeters}m
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        {route.estimatedTimeMinutes} min
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold border flex items-center gap-0.5 ${diffConfig.bgClass}`}
                      >
                        {diffConfig.icon}
                        {diffConfig.label}
                      </span>
                      <RatingDisplay rating={route.overallRating} total={route.totalRatings} />
                    </div>

                    {/* Compatibility Badges */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {route.wheelchairFriendly && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-900/50 text-blue-400 border border-blue-800 rounded-full font-bold flex items-center gap-0.5">
                          ♿ Wheelchair
                        </span>
                      )}
                      {route.visuallyFriendly && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-purple-900/50 text-purple-400 border border-purple-800 rounded-full font-bold flex items-center gap-0.5">
                          <Eye className="w-2.5 h-2.5" />
                          Visual Aids
                        </span>
                      )}
                      {route.mobilityAidCompatible && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-cyan-900/50 text-cyan-400 border border-cyan-800 rounded-full font-bold flex items-center gap-0.5">
                          🦽 Mobility Aid
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedRouteId(isExpanded ? null : route.id);
                    }}
                    className="p-1 text-slate-500 hover:text-white transition-colors shrink-0"
                    aria-label={isExpanded ? "Collapse route details" : "Expand route details"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-3">
                  {/* Transit Stop & Venue Entrance Info */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-800 rounded-lg p-2">
                      <div className="flex items-center gap-1 text-[9px] text-slate-500 uppercase font-bold mb-1">
                        <Bus className="w-3 h-3" />
                        From
                      </div>
                      <div className="text-[11px] text-white font-bold truncate">
                        {route.transitStop.name}
                      </div>
                      <div className="text-[9px] text-slate-500 capitalize">
                        {route.transitStop.type.replace("-", " ")}
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-2">
                      <div className="flex items-center gap-1 text-[9px] text-slate-500 uppercase font-bold mb-1">
                        <Building2 className="w-3 h-3" />
                        To
                      </div>
                      <div className="text-[11px] text-white font-bold truncate">
                        {route.venueEntrance.venueName}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        {route.venueEntrance.entranceName}
                      </div>
                    </div>
                  </div>

                  {/* Pathway Summary */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] text-slate-400 uppercase font-bold">
                      Pathways ({route.pathways.length})
                    </h4>
                    {route.pathways.map((pw) => (
                      <div
                        key={pw.id}
                        className="bg-slate-800/50 rounded-lg px-2.5 py-1.5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px]">{SURFACE_ICONS[pw.surface] || "🛣️"}</span>
                          <span className="text-[11px] text-slate-300 truncate">{pw.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] text-slate-500">{pw.widthMeters}m wide</span>
                          {pw.hasRamp && <span className="text-[9px]">♿</span>}
                          {pw.hasTactilePaving && <span className="text-[9px]">🟫</span>}
                          {pw.hasHandrails && <span className="text-[9px]">🦯</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Facilities */}
                  {totalFacilities > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] text-slate-400 uppercase font-bold">
                        Facilities ({totalFacilities})
                      </h4>
                      {route.pathways.flatMap((pw) =>
                        pw.facilities.map((f) => {
                          const label = FACILITY_LABELS[f.type];
                          if (!label) return null;
                          return (
                            <div
                              key={f.id}
                              className="flex items-center gap-2 text-[11px] px-2 py-1 bg-slate-800/50 rounded"
                            >
                              <span>{label.emoji}</span>
                              <span className={`font-bold ${label.color}`}>{f.name}</span>
                              <span className="text-slate-500 ml-auto">
                                {f.operational ? "✓" : "✕"}
                              </span>
                            </div>
                          );
                        }),
                      )}
                    </div>
                  )}

                  {/* Obstacles */}
                  {totalObstacles > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] text-red-400 uppercase font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Obstacles ({totalObstacles})
                      </h4>
                      {route.pathways.flatMap((pw) =>
                        pw.obstacles.map((o) => {
                          const label = OBSTACLE_LABELS[o.type];
                          const severity = SEVERITY_CONFIG[o.severity];
                          if (!label) return null;
                          return (
                            <div
                              key={o.id}
                              className="flex items-center gap-2 text-[11px] px-2 py-1 bg-red-950/30 rounded border border-red-900/50"
                            >
                              <span className={`font-bold ${label.color}`}>{label.label}</span>
                              <span
                                className={`text-[9px] px-1 py-0.5 rounded ${severity?.bgClass || ""}`}
                              >
                                {severity?.label}
                              </span>
                              {o.workaround && (
                                <span className="text-[9px] text-amber-400 ml-auto truncate max-w-[120px]">
                                  → {o.workaround}
                                </span>
                              )}
                            </div>
                          );
                        }),
                      )}
                    </div>
                  )}

                  {/* Turn-by-Turn Directions */}
                  {route.turns.length > 0 && (
                    <div className="space-y-1.5">
                      <button
                        onClick={() => setShowTurns(!showTurns)}
                        className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1 hover:text-white transition-colors"
                      >
                        <Navigation className="w-3 h-3" />
                        Turn-by-Turn Directions ({route.turns.length})
                        {showTurns ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                      {showTurns && (
                        <ol className="space-y-1" role="list">
                          {route.turns.map((turn, i) => (
                            <li
                              key={i}
                              className="flex gap-2 text-[11px] bg-slate-800/50 rounded px-2 py-1.5"
                            >
                              <span className="text-violet-400 font-bold shrink-0 w-4">
                                {i + 1}.
                              </span>
                              <div className="min-w-0">
                                <span className="text-slate-300">{turn.instruction}</span>
                                <span className="text-slate-500 ml-1">
                                  ({turn.distanceMeters}m)
                                </span>
                                {turn.landmark && (
                                  <span className="text-cyan-400 ml-1">· Near {turn.landmark}</span>
                                )}
                                {turn.caution && (
                                  <span className="block text-amber-400 text-[10px] mt-0.5">
                                    ⚠ {turn.caution}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}

                  {/* Report Issue Button */}
                  <button
                    onClick={() => onReportIssue(route.id)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] text-slate-300 font-bold transition-colors"
                    aria-label={`Report accessibility issue for route ${route.name}`}
                  >
                    <Flag className="w-3 h-3" />
                    Report Accessibility Issue
                  </button>

                  {/* Issues Count */}
                  {route.reportedIssues > 0 && (
                    <div className="text-[10px] text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {route.reportedIssues} reported issue{route.reportedIssues !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AccessibilityRoutePanel;
