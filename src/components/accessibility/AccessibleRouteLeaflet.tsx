import React, { useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
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
  Info,
  Star,
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

// ─── Leaflet Icon Factories ─────────────────────────────────────────────

function createDivIcon(html: string, className = ""): L.DivIcon {
  return L.divIcon({
    html,
    className: `bg-transparent border-none ${className}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

const TRANSIT_ICON = L.divIcon({
  html: `<div style="background:#10b981;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);">
    <span style="font-size:14px;">🚌</span>
  </div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const TRANSIT_SELECTED_ICON = L.divIcon({
  html: `<div style="background:#7c3aed;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 12px rgba(124,58,237,.5);">
    <span style="font-size:16px;">🚌</span>
  </div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function createVenueEntranceIcon(hasRamp: boolean, isSelected: boolean): L.DivIcon {
  const bg = isSelected ? "#7c3aed" : hasRamp ? "#10b981" : "#f59e0b";
  const size = isSelected ? 32 : 28;
  return L.divIcon({
    html: `<div style="background:${bg};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);">
      <span style="font-size:14px;">📍</span>
    </div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function createFacilityIcon(type: string): L.DivIcon {
  const icons: Record<string, { emoji: string; bg: string }> = {
    ramp: { emoji: "♿", bg: "#10b981" },
    elevator: { emoji: "🛗", bg: "#8b5cf6" },
    "automatic-door": { emoji: "🚪", bg: "#3b82f6" },
    "tactile-paving": { emoji: "🟫", bg: "#f59e0b" },
    "rest-area": { emoji: "🪑", bg: "#06b6d4" },
    "accessible-restroom": { emoji: "🚻", bg: "#ec4899" },
  };
  const icon = icons[type] || { emoji: "📍", bg: "#64748b" };
  return L.divIcon({
    html: `<div style="background:${icon.bg};width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);font-size:12px;">
      ${icon.emoji}
    </div>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createObstacleIcon(type: string, severity: string): L.DivIcon {
  const colors: Record<string, string> = {
    stairs: "#ef4444",
    curb: "#f97316",
    narrow: "#eab308",
    "steep-grade": "#dc2626",
    construction: "#f59e0b",
    "door-threshold": "#fb923c",
    none: "#22c55e",
  };
  const bg = colors[type] || "#ef4444";
  const size = severity === "blocking" ? 28 : 24;
  return L.divIcon({
    html: `<div style="background:${bg};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);font-size:12px;color:white;font-weight:bold;">
      ✕
    </div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

const TURN_ICON = L.divIcon({
  html: `<div style="background:#7c3aed;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);font-size:10px;color:white;font-weight:bold;">
  </div>`,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// ─── Map Auto-Fit Component ─────────────────────────────────────────────

function MapAutoFit({
  center,
  zoom,
  bounds,
}: {
  center?: [number, number];
  zoom?: number;
  bounds?: L.LatLngBoundsExpression;
}) {
  const map = useMap();

  React.useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (center) {
      map.setView(center, zoom || 15);
    }
  }, [map, center, zoom, bounds]);

  return null;
}

// ─── Facility Info Card ─────────────────────────────────────────────────

const FACILITY_INFO: Record<
  string,
  { label: string; color: string; bgClass: string; borderClass: string }
> = {
  ramp: { label: "Wheelchair Ramp", color: "#10b981", bgClass: "bg-emerald-50", borderClass: "border-emerald-200" },
  elevator: { label: "Elevator", color: "#8b5cf6", bgClass: "bg-violet-50", borderClass: "border-violet-200" },
  "automatic-door": { label: "Automatic Door", color: "#3b82f6", bgClass: "bg-blue-50", borderClass: "border-blue-200" },
  "tactile-paving": { label: "Tactile Paving", color: "#f59e0b", bgClass: "bg-amber-50", borderClass: "border-amber-200" },
  "rest-area": { label: "Rest Area", color: "#06b6d4", bgClass: "bg-cyan-50", borderClass: "border-cyan-200" },
  "accessible-restroom": { label: "Accessible Restroom", color: "#ec4899", bgClass: "bg-pink-50", borderClass: "border-pink-200" },
};

const OBSTACLE_INFO: Record<string, { label: string; color: string }> = {
  stairs: { label: "Stairs (Not Accessible)", color: "#ef4444" },
  curb: { label: "Curb (No Ramp)", color: "#f97316" },
  narrow: { label: "Narrow Pathway", color: "#eab308" },
  "steep-grade": { label: "Steep Grade", color: "#dc2626" },
  construction: { label: "Construction Zone", color: "#f59e0b" },
  "door-threshold": { label: "Door Threshold", color: "#fb923c" },
  none: { label: "No Obstacles", color: "#22c55e" },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-800 border-emerald-300",
  moderate: "bg-amber-100 text-amber-800 border-amber-300",
  challenging: "bg-red-100 text-red-800 border-red-300",
};

const SURFACE_LABELS: Record<string, string> = {
  paved: "Paved",
  concrete: "Concrete",
  tile: "Tile",
  gravel: "Gravel",
  grass: "Grass",
  carpet: "Carpet",
};

// ─── Props ──────────────────────────────────────────────────────────────

interface AccessibleRouteLeafletProps {
  routes: AccessibleRoute[];
  pathways: AccessiblePathway[];
  transitStops: TransitStop[];
  venueEntrances: VenueEntrance[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  showPathways: boolean;
  showFacilities: boolean;
  showObstacles: boolean;
  selectedTransitStopId?: string | null;
  selectedVenueEntranceId?: string | null;
}

// ─── Component ──────────────────────────────────────────────────────────

const AccessibleRouteLeaflet: React.FC<AccessibleRouteLeafletProps> = ({
  routes,
  pathways,
  transitStops,
  venueEntrances,
  selectedRouteId,
  onSelectRoute,
  showPathways,
  showFacilities,
  showObstacles,
  selectedTransitStopId,
  selectedVenueEntranceId,
}) => {
  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId),
    [routes, selectedRouteId],
  );

  // Compute map center from all points
  const mapCenter = useMemo((): [number, number] => {
    const allPoints: [number, number][] = [];
    transitStops.forEach((s) => allPoints.push([s.position.lat, s.position.lng]));
    venueEntrances.forEach((e) => allPoints.push([e.position.lat, e.position.lng]));
    if (allPoints.length === 0) return [40.805, -73.938];
    const avgLat = allPoints.reduce((sum, p) => sum + p[0], 0) / allPoints.length;
    const avgLng = allPoints.reduce((sum, p) => sum + p[1], 0) / allPoints.length;
    return [avgLat, avgLng];
  }, [transitStops, venueEntrances]);

  // Compute bounds for auto-fit
  const bounds = useMemo((): L.LatLngBoundsExpression | null => {
    const allPoints: [number, number][] = [];
    transitStops.forEach((s) => allPoints.push([s.position.lat, s.position.lng]));
    venueEntrances.forEach((e) => allPoints.push([e.position.lat, e.position.lng]));
    if (allPoints.length < 2) return null;
    return allPoints;
  }, [transitStops, venueEntrances]);

  // Collect all facilities and obstacles from pathways
  const allFacilities = useMemo(() => {
    if (!showFacilities) return [];
    const result: (PathwayFacility & { pathwayId: string })[] = [];
    const source = selectedRoute ? selectedRoute.pathways : pathways;
    source.forEach((pw) => {
      pw.facilities.forEach((f) => result.push({ ...f, pathwayId: pw.id }));
    });
    return result;
  }, [showFacilities, selectedRoute, pathways]);

  const allObstacles = useMemo(() => {
    if (!showObstacles) return [];
    const result: (PathwayObstacle & { pathwayId: string })[] = [];
    const source = selectedRoute ? selectedRoute.pathways : pathways;
    source.forEach((pw) => {
      pw.obstacles.forEach((o) => result.push({ ...o, pathwayId: pw.id }));
    });
    return result;
  }, [showObstacles, selectedRoute, pathways]);

  // Convert pathway geometry to Leaflet polylines
  const pathwayPolylines = useMemo(() => {
    if (!showPathways) return [];
    const source = pathways;
    return source.map((pw) => ({
      id: pw.id,
      positions: pw.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      ),
      surface: pw.surface,
      name: pw.name,
    }));
  }, [showPathways, pathways]);

  // Selected route pathway polylines
  const selectedRoutePolylines = useMemo(() => {
    if (!selectedRoute) return [];
    return selectedRoute.pathways.map((pw) => ({
      id: pw.id,
      positions: pw.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      ),
      surface: pw.surface,
    }));
  }, [selectedRoute]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Map Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Campus Map
          </span>
          {selectedRoute && (
            <span className="text-[10px] px-2 py-0.5 bg-violet-900/50 text-violet-400 border border-violet-800 rounded-full font-bold">
              Viewing: {selectedRoute.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">
            {routes.length} route{routes.length !== 1 ? "s" : ""} available
          </span>
        </div>
      </div>

      {/* Leaflet Map */}
      <div className="relative" style={{ height: "500px" }}>
        <MapContainer
          center={mapCenter}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {bounds && <MapAutoFit bounds={bounds} />}

          {/* Background pathways (dimmed) */}
          {showPathways &&
            pathwayPolylines.map((pl) => (
              <Polyline
                key={`bg-${pl.id}`}
                positions={pl.positions}
                pathOptions={{
                  color: "#475569",
                  weight: 3,
                  opacity: 0.3,
                  dashArray: pl.surface === "gravel" ? "8 4" : undefined,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{pl.name}</strong>
                    <br />
                    Surface: {SURFACE_LABELS[pl.surface] || pl.surface}
                  </div>
                </Popup>
              </Polyline>
            ))}

          {/* Selected route pathway polylines */}
          {selectedRoutePolylines.map((pl) => (
            <React.Fragment key={`route-${pl.id}`}>
              {/* Glow effect */}
              <Polyline
                positions={pl.positions}
                pathOptions={{
                  color: "#06b6d4",
                  weight: 10,
                  opacity: 0.25,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              {/* Main route line */}
              <Polyline
                positions={pl.positions}
                pathOptions={{
                  color: "#8b5cf6",
                  weight: 5,
                  opacity: 0.9,
                  lineCap: "round",
                  lineJoin: "round",
                  dashArray: pl.surface === "gravel" ? "8 4" : undefined,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>Accessible Pathway</strong>
                    <br />
                    Surface: {SURFACE_LABELS[pl.surface] || pl.surface}
                  </div>
                </Popup>
              </Polyline>
            </React.Fragment>
          ))}

          {/* Transit stop markers */}
          {transitStops.map((stop) => {
            const isSelected = selectedTransitStopId === stop.id || selectedRoute?.transitStopId === stop.id;
            return (
              <Marker
                key={`transit-${stop.id}`}
                position={[stop.position.lat, stop.position.lng]}
                icon={isSelected ? TRANSIT_SELECTED_ICON : TRANSIT_ICON}
                eventHandlers={{
                  click: () => {
                    const route = routes.find((r) => r.transitStopId === stop.id);
                    if (route) onSelectRoute(route.id);
                  },
                }}
              >
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <div className="font-bold text-gray-900">{stop.name}</div>
                    <div className="text-gray-600 text-xs mt-1 capitalize">
                      {stop.type.replace("-", " ")}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {stop.accessible && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">
                          ♿ Accessible
                        </span>
                      )}
                      {stop.hasShelter && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">
                          🏠 Shelter
                        </span>
                      )}
                    </div>
                    {routes.some((r) => r.transitStopId === stop.id) && (
                      <button
                        onClick={() => {
                          const route = routes.find((r) => r.transitStopId === stop.id);
                          if (route) onSelectRoute(route.id);
                        }}
                        className="mt-2 text-xs text-violet-600 font-bold hover:underline"
                      >
                        View Route →
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Venue entrance markers */}
          {venueEntrances.map((entrance) => {
            const isSelected =
              selectedVenueEntranceId === entrance.id ||
              selectedRoute?.venueEntranceId === entrance.id;
            return (
              <Marker
                key={`entrance-${entrance.id}`}
                position={[entrance.position.lat, entrance.position.lng]}
                icon={createVenueEntranceIcon(entrance.hasRamp, isSelected)}
              >
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <div className="font-bold text-gray-900">
                      {entrance.venueName}
                    </div>
                    <div className="text-gray-600 text-xs mt-1">
                      {entrance.entranceName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      {entrance.hasRamp && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">
                          ♿ Ramp
                        </span>
                      )}
                      {entrance.hasAutomaticDoor && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">
                          🚪 Auto Door
                        </span>
                      )}
                      {entrance.doorWidthCm && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">
                          {entrance.doorWidthCm}cm wide
                        </span>
                      )}
                    </div>
                    {entrance.description && (
                      <p className="text-xs text-gray-500 mt-2">
                        {entrance.description}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Facility markers */}
          {allFacilities.map((f) => {
            const info = FACILITY_INFO[f.type];
            if (!info) return null;
            return (
              <Marker
                key={`facility-${f.id}`}
                position={[f.position.lat, f.position.lng]}
                icon={createFacilityIcon(f.type)}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold text-gray-900">{f.name}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {info.label}
                    </div>
                    {f.description && (
                      <p className="text-xs text-gray-500 mt-1">
                        {f.description}
                      </p>
                    )}
                    <div className="mt-2">
                      {f.operational ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">
                          ✓ Operational
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold">
                          ✕ Not Operational
                        </span>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Obstacle markers */}
          {allObstacles.map((o) => {
            const info = OBSTACLE_INFO[o.type];
            if (!info) return null;
            return (
              <Marker
                key={`obstacle-${o.id}`}
                position={[o.position.lat, o.position.lng]}
                icon={createObstacleIcon(o.type, o.severity)}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold text-red-700">{info.label}</div>
                    <div className="text-xs text-gray-600 mt-1 capitalize">
                      Severity: {o.severity}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{o.description}</p>
                    {o.workaround && (
                      <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-1.5 rounded">
                        Workaround: {o.workaround}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Route turn waypoints */}
          {selectedRoute?.turns.map((turn, i) => (
            <Marker
              key={`turn-${i}`}
              position={[turn.waypoint.lat, turn.waypoint.lng]}
              icon={TURN_ICON}
            >
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <div className="font-bold text-violet-700">
                    Step {i + 1}
                  </div>
                  <p className="text-xs text-gray-700 mt-1">
                    {turn.instruction}
                  </p>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {turn.distanceMeters}m
                    {turn.landmark && ` · Near ${turn.landmark}`}
                  </div>
                  {turn.caution && (
                    <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded font-bold">
                      ⚠ {turn.caution}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Map Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl p-3 text-[10px] space-y-1.5 max-w-[200px]">
          <span className="font-bold text-slate-400 uppercase block mb-1">
            Legend
          </span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-1 bg-gradient-to-r from-violet-500 to-cyan-500 rounded" />
            <span className="text-slate-300">Accessible Route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white" />
            <span className="text-slate-300">Ramp / Accessible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-500 border border-white" />
            <span className="text-slate-300">Elevator</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 border border-white" />
            <span className="text-slate-300">Automatic Door</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 border border-white" />
            <span className="text-slate-300">Obstacle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-emerald-600 rounded border border-white" />
            <span className="text-slate-300">Transit Stop</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 border border-white" />
            <span className="text-slate-300">Venue Entrance</span>
          </div>
        </div>
      </div>

      {/* Route Quick Select Bar */}
      {routes.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-800 flex flex-wrap gap-2">
          {routes.map((route) => {
            const isSelected = route.id === selectedRouteId;
            return (
              <button
                key={route.id}
                onClick={() => onSelectRoute(route.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                  isSelected
                    ? "bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-500/25"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white"
                }`}
                aria-pressed={isSelected}
                aria-label={`Select route: ${route.name}`}
              >
                <Navigation className="w-3 h-3" />
                {route.name}
                <span className="text-[9px] opacity-70">
                  {route.totalDistanceMeters}m · {route.estimatedTimeMinutes}min
                </span>
                {route.verified && (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AccessibleRouteLeaflet;
