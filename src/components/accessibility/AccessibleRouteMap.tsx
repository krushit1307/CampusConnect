import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  MapPin,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Accessibility,
  Bus,
  Car,
  Building2,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import type {
  AccessibleRoute,
  AccessiblePathway,
  TransitStop,
  VenueEntrance,
  PathwayFacility,
  PathwayObstacle,
  GeoPoint,
} from "../../types/accessibility";

// ─── Map Config ──────────────────────────────────────────────────────────

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;
const CAMPUS_BOUNDS = {
  minLat: 40.799,
  maxLat: 40.812,
  minLng: -73.945,
  maxLng: -73.930,
};

function latLngToXY(lat: number, lng: number): { x: number; y: number } {
  const x =
    ((lng - CAMPUS_BOUNDS.minLng) / (CAMPUS_BOUNDS.maxLng - CAMPUS_BOUNDS.minLng)) * MAP_WIDTH;
  const y =
    MAP_HEIGHT -
    ((lat - CAMPUS_BOUNDS.minLat) / (CAMPUS_BOUNDS.maxLat - CAMPUS_BOUNDS.minLat)) * MAP_HEIGHT;
  return { x, y };
}

// ─── SVG Helpers ─────────────────────────────────────────────────────────

function pointsToSvgPath(points: GeoPoint[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => {
      const { x, y } = latLngToXY(p.lat, p.lng);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

// ─── Facility Icons ──────────────────────────────────────────────────────

const FACILITY_ICONS: Record<string, { label: string; color: string; emoji: string }> = {
  ramp: { label: "Wheelchair Ramp", color: "#10b981", emoji: "♿" },
  elevator: { label: "Elevator", color: "#8b5cf6", emoji: "🛗" },
  "automatic-door": { label: "Automatic Door", color: "#3b82f6", emoji: "🚪" },
  "tactile-paving": { label: "Tactile Paving", color: "#f59e0b", emoji: "🟫" },
  "rest-area": { label: "Rest Area", color: "#06b6d4", emoji: "🪑" },
  "accessible-restroom": { label: "Accessible Restroom", color: "#ec4899", emoji: "🚻" },
};

const OBSTACLE_ICONS: Record<string, { label: string; color: string }> = {
  stairs: { label: "Stairs (Not Accessible)", color: "#ef4444" },
  curb: { label: "Curb (No Ramp)", color: "#f97316" },
  narrow: { label: "Narrow Pathway", color: "#eab308" },
  "steep-grade": { label: "Steep Grade", color: "#dc2626" },
  construction: { label: "Construction Zone", color: "#f59e0b" },
  "door-threshold": { label: "Door Threshold", color: "#fb923c" },
  none: { label: "No Obstacles", color: "#22c55e" },
};

// ─── Route Map Component ─────────────────────────────────────────────────

interface AccessibleRouteMapProps {
  routes: AccessibleRoute[];
  pathways: AccessiblePathway[];
  transitStops: TransitStop[];
  venueEntrances: VenueEntrance[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  showPathways: boolean;
  showFacilities: boolean;
  showObstacles: boolean;
}

const AccessibleRouteMap: React.FC<AccessibleRouteMapProps> = ({
  routes,
  pathways,
  transitStops,
  venueEntrances,
  selectedRouteId,
  onSelectRoute,
  showPathways,
  showFacilities,
  showObstacles,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.2, 3)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.2, 0.5)), []);
  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Selected route pathway data
  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId),
    [routes, selectedRouteId]
  );

  // All facility points from selected route
  const facilityPoints = useMemo(() => {
    if (!selectedRoute) return [];
    const points: (PathwayFacility & { pathwayId: string })[] = [];
    selectedRoute.pathways.forEach((p) => {
      p.facilities.forEach((f) => {
        points.push({ ...f, pathwayId: p.id });
      });
    });
    return points;
  }, [selectedRoute]);

  // All obstacle points from selected route
  const obstaclePoints = useMemo(() => {
    if (!selectedRoute) return [];
    const points: (PathwayObstacle & { pathwayId: string })[] = [];
    selectedRoute.pathways.forEach((p) => {
      p.obstacles.forEach((o) => {
        points.push({ ...o, pathwayId: p.id });
      });
    });
    return points;
  }, [selectedRoute]);

  // Turn waypoints
  const turnWaypoints = useMemo(() => {
    if (!selectedRoute) return [];
    return selectedRoute.turns.map((t, i) => ({
      ...t,
      index: i,
    }));
  }, [selectedRoute]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Map Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Campus Map</span>
          {selectedRoute && (
            <span className="text-[10px] px-2 py-0.5 bg-violet-900/50 text-violet-400 border border-violet-800 rounded-full font-bold">
              Viewing: {selectedRoute.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`p-1.5 rounded-lg transition-colors ${
              showLabels ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-500"
            }`}
            title="Toggle labels"
          >
            {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button onClick={handleZoomIn} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={handleZoomOut} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={handleReset} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Reset view">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SVG Map */}
      <div className="relative overflow-hidden" style={{ height: "500px" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="w-full h-full"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: "center center",
          }}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgb(30,41,59)" strokeWidth="0.5" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="rgb(15,23,42)" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#grid)" />

          {/* Campus buildings (simplified) */}
          {[
            { name: "Student Union", x: 500, y: 350, w: 120, h: 80 },
            { name: "Science Hall", x: 200, y: 200, w: 100, h: 70 },
            { name: "Library", x: 700, y: 250, w: 140, h: 90 },
            { name: "Engineering Bldg", x: 350, y: 500, w: 110, h: 75 },
            { name: "Arts Center", x: 800, y: 450, w: 100, h: 65 },
            { name: "Gymnasium", x: 150, y: 450, w: 90, h: 80 },
            { name: "Admin Building", x: 600, y: 550, w: 105, h: 70 },
          ].map((b) => (
            <g key={b.name}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={6}
                fill="rgb(30,41,59)"
                stroke="rgb(51,65,85)"
                strokeWidth={1}
              />
              {showLabels && (
                <text
                  x={b.x + b.w / 2}
                  y={b.y + b.h / 2 + 4}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-500 font-sans"
                  fontSize={10}
                >
                  {b.name}
                </text>
              )}
            </g>
          ))}

          {/* Background pathways (all, dimmed) */}
          {showPathways &&
            pathways.map((p) => {
              const path = pointsToSvgPath(
                p.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
              );
              return (
                <path
                  key={p.id}
                  d={path}
                  fill="none"
                  stroke="rgb(51,65,85)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.3}
                />
              );
            })}

          {/* Selected route pathways (highlighted) */}
          {selectedRoute &&
            selectedRoute.pathways.map((p) => {
              const path = pointsToSvgPath(
                p.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
              );
              return (
                <g key={`route-${p.id}`}>
                  {/* Glow effect */}
                  <path
                    d={path}
                    fill="none"
                    stroke="url(#routeGradient)"
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.3}
                    filter="url(#glow)"
                  />
                  {/* Main path */}
                  <path
                    d={path}
                    fill="none"
                    stroke="url(#routeGradient)"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={p.surface === "gravel" ? "8 4" : "none"}
                  />
                </g>
              );
            })}

          {/* Turn waypoints */}
          {turnWaypoints.map((turn) => {
            const { x, y } = latLngToXY(turn.waypoint.lat, turn.waypoint.lng);
            return (
              <g key={`turn-${turn.index}`}>
                <circle cx={x} cy={y} r={8} fill="rgb(139,92,246)" opacity={0.2} />
                <circle cx={x} cy={y} r={4} fill="rgb(139,92,246)" stroke="white" strokeWidth={1.5} />
                {showLabels && (
                  <text
                    x={x + 12}
                    y={y + 4}
                    className="text-[9px] fill-violet-300 font-sans"
                    fontSize={9}
                  >
                    {turn.index + 1}. {turn.instruction.substring(0, 30)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Facility markers */}
          {showFacilities &&
            facilityPoints.map((f) => {
              const { x, y } = latLngToXY(f.position.lat, f.position.lng);
              const icon = FACILITY_ICONS[f.type];
              return (
                <g key={f.id}>
                  <circle cx={x} cy={y} r={10} fill={icon.color} opacity={0.2} />
                  <circle cx={x} cy={y} r={6} fill={icon.color} stroke="white" strokeWidth={1} />
                  {showLabels && (
                    <text x={x + 14} y={y + 4} fontSize={9} className="fill-slate-300 font-sans">
                      {icon.emoji} {f.name}
                    </text>
                  )}
                </g>
              );
            })}

          {/* Obstacle markers */}
          {showObstacles &&
            obstaclePoints.map((o) => {
              const { x, y } = latLngToXY(o.position.lat, o.position.lng);
              const icon = OBSTACLE_ICONS[o.type];
              const size = o.severity === "blocking" ? 8 : o.severity === "severe" ? 7 : 6;
              return (
                <g key={o.id}>
                  <circle cx={x} cy={y} r={size + 4} fill={icon.color} opacity={0.15} />
                  <circle cx={x} cy={y} r={size} fill={icon.color} stroke="white" strokeWidth={1} />
                  <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fill="white" fontWeight="bold">
                    ✕
                  </text>
                  {showLabels && (
                    <text x={x + 14} y={y + 4} fontSize={8} className="fill-red-300 font-sans">
                      {icon.label}
                    </text>
                  )}
                </g>
              );
            })}

          {/* Transit stops */}
          {transitStops.map((stop) => {
            const { x, y } = latLngToXY(stop.position.lat, stop.position.lng);
            const isSelected = selectedRoute?.transitStopId === stop.id;
            return (
              <g
                key={stop.id}
                className="cursor-pointer"
                onClick={() => {
                  const route = routes.find((r) => r.transitStopId === stop.id);
                  if (route) onSelectRoute(route.id);
                }}
              >
                <rect
                  x={x - 12}
                  y={y - 12}
                  width={24}
                  height={24}
                  rx={6}
                  fill={isSelected ? "#8b5cf6" : stop.accessible ? "#10b981" : "#64748b"}
                  stroke="white"
                  strokeWidth={isSelected ? 2 : 1}
                />
                <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fill="white">
                  {stop.type === "bus-stop" ? "🚌" : stop.type === "shuttle-stop" ? "🚐" : "🅿️"}
                </text>
                {showLabels && (
                  <text x={x} y={y - 18} textAnchor="middle" fontSize={9} className="fill-slate-300 font-sans" fontWeight="bold">
                    {stop.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* Venue entrances */}
          {venueEntrances.map((entrance) => {
            const { x, y } = latLngToXY(entrance.position.lat, entrance.position.lng);
            const isSelected = selectedRoute?.venueEntranceId === entrance.id;
            return (
              <g key={entrance.id}>
                <polygon
                  points={`${x},${y - 10} ${x - 8},${y + 6} ${x + 8},${y + 6}`}
                  fill={isSelected ? "#8b5cf6" : entrance.hasRamp ? "#10b981" : "#f59e0b"}
                  stroke="white"
                  strokeWidth={isSelected ? 2 : 1}
                />
                {showLabels && (
                  <text x={x} y={y + 22} textAnchor="middle" fontSize={8} className="fill-slate-400 font-sans">
                    {entrance.venueName} ({entrance.entranceName})
                  </text>
                )}
              </g>
            );
          })}

          {/* Route hover effect for non-selected routes */}
          {hoveredRoute &&
            hoveredRoute !== selectedRouteId &&
            (() => {
              const route = routes.find((r) => r.id === hoveredRoute);
              if (!route) return null;
              return route.pathways.map((p) => {
                const path = pointsToSvgPath(
                  p.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
                );
                return (
                  <path
                    key={`hover-${p.id}`}
                    d={path}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    strokeLinecap="round"
                    opacity={0.4}
                    strokeDasharray="6 3"
                  />
                );
              });
            })()}
        </svg>

        {/* Map Legend */}
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl p-3 text-[10px] space-y-1.5">
          <span className="font-bold text-slate-400 uppercase block mb-1">Legend</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 rounded" />
            <span className="text-slate-300">Accessible Route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-300">Ramp / Accessible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-slate-300">Elevator</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-slate-300">Obstacle / Blockage</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-slate-600" />
            <span className="text-slate-300">Transit Stop</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessibleRouteMap;
