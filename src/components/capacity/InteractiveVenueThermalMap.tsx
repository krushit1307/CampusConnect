// =============================================================================
// File: src/components/capacity/InteractiveVenueThermalMap.tsx
// Issue: #4283 - Build a 'Real-Time "Event Capacity" Thermal Map'
// Description: Interactive 2D Venue Floorplan Heatmap, Cisco Meraki / Aruba WiFi
//              access point telemetry visualizer, crowd surge alerts, and push dispatch.
// =============================================================================

import React, { useState, useMemo, useEffect } from "react";
import {
  Flame,
  Radio,
  Users,
  ShieldAlert,
  ShieldCheck,
  Download,
  Bell,
  RefreshCw,
  Eye,
  EyeOff,
  Activity,
  Layers,
  MapPin,
  AlertTriangle,
  ArrowRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  DoorOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  VenueZone,
  WiFiAccessPoint,
  ThermalHeatmapPoint,
  CrowdSurgeAlert,
  CrowdRedirectBroadcast,
} from "@/types/capacityThermalMap";
import {
  getMockVenueZones,
  getMockWiFiAccessPoints,
  computeThermalHeatmapPoints,
  generateCrowdSurgeAlerts,
  exportCapacityComplianceCSV,
} from "@/services/capacityThermalMapService";
import {
  simulateCrowdTick,
  calculateFacilitySummary,
} from "@/services/wifiTelemetryStreamSimulator";
import { CrowdRedirectNotificationModal } from "@/components/capacity/CrowdRedirectNotificationModal";
import { VenueEgressSimulatorPanel } from "@/components/capacity/VenueEgressSimulatorPanel";

interface InteractiveVenueThermalMapProps {
  initialZones?: VenueZone[];
  initialAccessPoints?: WiFiAccessPoint[];
  eventTitle?: string;
}

export const InteractiveVenueThermalMap: React.FC<InteractiveVenueThermalMapProps> = ({
  initialZones,
  initialAccessPoints,
  eventTitle = "Annual Spring Campus Career Fair 2026",
}) => {
  const [zones, setZones] = useState<VenueZone[]>(initialZones || getMockVenueZones());
  const [accessPoints, setAccessPoints] = useState<WiFiAccessPoint[]>(
    initialAccessPoints || getMockWiFiAccessPoints()
  );

  const [activeMainTab, setActiveMainTab] = useState<string>("thermal_map");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedApId, setSelectedApId] = useState<string | null>(null);
  const [showAccessPoints, setShowAccessPoints] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [isRedirectionActive, setIsRedirectionActive] = useState<boolean>(false);
  const [activeSurgeAlert, setActiveSurgeAlert] = useState<CrowdSurgeAlert | null>(null);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState<boolean>(false);
  const [broadcastLog, setBroadcastLog] = useState<CrowdRedirectBroadcast[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Active surge alerts generated from current zone state
  const surgeAlerts = useMemo(() => generateCrowdSurgeAlerts(zones), [zones]);
  const primaryFireHazard = surgeAlerts.find((a) => a.severity === "CRITICAL_FIRE_HAZARD") || null;

  // Facility summary metrics
  const facilitySummary = useMemo(() => calculateFacilitySummary(zones), [zones]);

  // Interpolated thermal points for 2D floorplan overlay
  const thermalPoints: ThermalHeatmapPoint[] = useMemo(() => {
    return computeThermalHeatmapPoints(accessPoints);
  }, [accessPoints]);

  // Selected Zone object
  const selectedZone = useMemo(() => {
    return zones.find((z) => z.id === selectedZoneId) || null;
  }, [zones, selectedZoneId]);

  // Selected AP object
  const selectedAp = useMemo(() => {
    return accessPoints.find((ap) => ap.id === selectedApId) || null;
  }, [accessPoints, selectedApId]);

  // Real-time WiFi Telemetry Polling & Physics Loop (every 4 seconds)
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      const { updatedZones, updatedAccessPoints } = simulateCrowdTick(
        zones,
        accessPoints,
        isRedirectionActive
      );
      setZones(updatedZones);
      setAccessPoints(updatedAccessPoints);
    }, 4000);

    return () => clearInterval(interval);
  }, [isLiveStreaming, isRedirectionActive, zones, accessPoints]);

  // Handle successful broadcast from modal
  const handleBroadcastSuccess = (broadcast: CrowdRedirectBroadcast) => {
    setBroadcastLog((prev) => [broadcast, ...prev]);
    setIsRedirectionActive(true);
    setSuccessToast(
      `Push broadcast dispatched to ${broadcast.targetAudienceCount} attendees! Redirection flow initiated toward Gym C.`
    );
    setTimeout(() => setSuccessToast(null), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Station */}
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-lime dark:bg-lime-400">
                <Flame className="h-5 w-5 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Real-Time Event Capacity Thermal Map
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Cisco Meraki & Aruba Enterprise WiFi Beacon Density Stream • {eventTitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLiveStreaming((prev) => !prev)}
              className={`neu-border flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
                isLiveStreaming
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-500"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <Activity
                className={`h-3.5 w-3.5 ${isLiveStreaming ? "animate-spin text-emerald-600" : ""}`}
              />
              {isLiveStreaming ? "Live Stream (4s)" : "Stream Paused"}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCapacityComplianceCSV(zones, accessPoints)}
              className="neu-border flex items-center gap-1.5 bg-lime font-mono text-xs font-bold uppercase text-black hover:bg-lime/80"
            >
              <Download className="h-3.5 w-3.5" />
              Export Fire Safety Audit CSV
            </Button>
          </div>
        </div>

        {/* Global Success Notification */}
        {successToast && (
          <div className="neu-border mt-4 flex items-center gap-2 bg-emerald-100 p-3 text-xs font-mono font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Emergency Fire Hazard Banner if Gym A is over capacity */}
        {primaryFireHazard && (
          <div className="neu-border mt-4 flex flex-col gap-3 border-rose-600 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/60 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-7 w-7 text-rose-600 animate-bounce" />
              <div>
                <span className="font-mono text-xs font-black uppercase text-rose-900 dark:text-rose-200">
                  🚨 Fire Hazard Alert: {primaryFireHazard.zoneName} at{" "}
                  {primaryFireHazard.occupancyRatioPercent}% Capacity!
                </span>
                <p className="font-mono text-xs text-rose-700 dark:text-rose-300">
                  Current headcount ({primaryFireHazard.currentOccupancy} attendees) exceeds safe fire
                  limit ({primaryFireHazard.maxCapacity}). Divert traffic to{" "}
                  <strong>{primaryFireHazard.suggestedRedirectZoneName}</strong>.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setActiveSurgeAlert(primaryFireHazard);
                setIsBroadcastModalOpen(true);
              }}
              className="neu-border bg-rose-600 font-mono text-xs font-black uppercase text-white hover:bg-rose-700 shadow-[4px_4px_0_0_#000]"
            >
              <Bell className="h-3.5 w-3.5 mr-1" />
              1-Click Crowd Push Redirect
            </Button>
          </div>
        )}

        {/* High-Level Facility KPI Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Total Facility Headcount
            </span>
            <div className="mt-1 font-mono text-xl font-black text-zinc-900 dark:text-white">
              {facilitySummary.totalOccupancy} / {facilitySummary.totalCapacity}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              {facilitySummary.overallPercentage}% safe capacity
            </span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Crowd Density
            </span>
            <div className="mt-1 font-mono text-xl font-black text-blue-600 dark:text-blue-400">
              {facilitySummary.attendeesPerM2} ppl/m²
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Across 3,700 m² venue</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Active WiFi Access Points
            </span>
            <div className="mt-1 font-mono text-xl font-black text-purple-600 dark:text-purple-400">
              {accessPoints.length} APs Online
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Cisco Meraki & Aruba</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Fire Code Violations
            </span>
            <div
              className={`mt-1 font-mono text-xl font-black ${
                facilitySummary.hasFireHazard
                  ? "text-rose-600 animate-pulse"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {facilitySummary.criticalZoneCount} Zones Over Limit
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Max limit enforcement</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Active Redirection Flow
            </span>
            <div className="mt-1 font-mono text-xl font-black text-emerald-600">
              {isRedirectionActive ? "ACTIVE (Gym C)" : "STANDBY"}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Auto load-balancer</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation: 2D Thermal Map vs Emergency Egress Simulator */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
        <TabsList className="neu-border grid w-full max-w-md grid-cols-2 bg-white p-1 dark:bg-zinc-900">
          <TabsTrigger
            value="thermal_map"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            2D Spatial Thermal Map
          </TabsTrigger>
          <TabsTrigger
            value="egress_simulator"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Emergency Egress Modeler
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Thermal Map */}
        <TabsContent value="thermal_map" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Col: 2D Interactive Venue Thermal Canvas (8 cols) */}
            <div className="space-y-4 lg:col-span-8">
              <div className="neu-border relative bg-zinc-950 p-4 text-white overflow-hidden min-h-[500px]">
                {/* Overlay Layer Toggles */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHeatmap((prev) => !prev)}
                    className={`neu-border px-2.5 py-1 font-mono text-[10px] font-bold uppercase transition-colors ${
                      showHeatmap ? "bg-lime text-black" : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {showHeatmap ? "Thermal Heatmap ON" : "Thermal Heatmap OFF"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAccessPoints((prev) => !prev)}
                    className={`neu-border px-2.5 py-1 font-mono text-[10px] font-bold uppercase transition-colors ${
                      showAccessPoints ? "bg-lime text-black" : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {showAccessPoints ? "WiFi APs ON" : "WiFi APs OFF"}
                  </button>
                </div>

                {/* Floorplan Title */}
                <div className="mb-4">
                  <span className="font-mono text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    Interactive 2D Spatial Density Map
                  </span>
                  <h3 className="font-mono text-sm font-black uppercase text-white">
                    Student Recreation Complex (Gym A • Gym B • Gym C)
                  </h3>
                </div>

                {/* SVG / Canvas Floorplan Representation */}
                <div className="relative w-full h-[400px] border-2 border-zinc-800 bg-zinc-900/90 rounded overflow-hidden">
                  {/* Radial Heat Gradients Layer */}
                  {showHeatmap && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                      <defs>
                        <radialGradient id="heat-critical" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
                          <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.55" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id="heat-moderate" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.7" />
                          <stop offset="60%" stopColor="#10b981" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id="heat-optimal" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                          <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </radialGradient>
                      </defs>

                      {thermalPoints.map((pt, i) => (
                        <circle
                          key={i}
                          cx={`${pt.x}%`}
                          cy={`${pt.y}%`}
                          r={pt.radius}
                          fill={
                            pt.intensity > 0.8
                              ? "url(#heat-critical)"
                              : pt.intensity > 0.5
                              ? "url(#heat-moderate)"
                              : "url(#heat-optimal)"
                          }
                          className={pt.intensity > 0.8 ? "animate-pulse" : ""}
                        />
                      ))}
                    </svg>
                  )}

                  {/* Physical Gymnasium Room Outlines */}
                  {zones.map((zone) => {
                    const isSelected = zone.id === selectedZoneId;
                    const isFireHazard = zone.safetyStatus === "critical_fire_hazard";

                    return (
                      <div
                        key={zone.id}
                        onClick={() => setSelectedZoneId(zone.id)}
                        style={{
                          left: `${zone.coordinates.x}%`,
                          top: `${zone.coordinates.y}%`,
                          width: `${zone.coordinates.width}%`,
                          height: `${zone.coordinates.height}%`,
                        }}
                        className={`absolute z-10 cursor-pointer border-2 rounded p-3 transition-all flex flex-col justify-between ${
                          isFireHazard
                            ? "border-rose-500 bg-rose-950/40 ring-2 ring-rose-500"
                            : zone.safetyStatus === "moderate_yellow"
                            ? "border-amber-500 bg-amber-950/20"
                            : "border-emerald-500 bg-emerald-950/20"
                        } ${isSelected ? "shadow-[0_0_15px_rgba(255,255,255,0.3)]" : ""}`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-black uppercase text-zinc-300">
                              {zone.name.split(" ")[0]} {zone.name.split(" ")[1]}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-black uppercase ${
                                isFireHazard
                                  ? "bg-rose-600 text-white animate-pulse"
                                  : zone.safetyStatus === "moderate_yellow"
                                  ? "bg-amber-400 text-black"
                                  : "bg-emerald-500 text-black"
                              }`}
                            >
                              {zone.occupancyPercentage}%
                            </span>
                          </div>
                          <p className="font-mono text-[9px] text-zinc-400 truncate mt-0.5">
                            {zone.name.split("(")[1]?.replace(")", "")}
                          </p>
                        </div>

                        <div className="font-mono text-[10px] text-zinc-300">
                          <div className="flex justify-between">
                            <span>Occupancy:</span>
                            <span className="font-bold">
                              {zone.currentOccupancyCount} / {zone.maxFireCodeCapacity}
                            </span>
                          </div>
                          <div className="flex justify-between text-zinc-400 text-[9px]">
                            <span>Dwell: {zone.averageDwellMinutes} min</span>
                            <span>+{zone.ingressRatePerMin}/min</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* WiFi Access Point Markers */}
                  {showAccessPoints &&
                    accessPoints.map((ap) => (
                      <div
                        key={ap.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedApId(ap.id);
                        }}
                        style={{ left: `${ap.location.x}%`, top: `${ap.location.y}%` }}
                        className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-black bg-white text-zinc-900 shadow-md group-hover:scale-125 transition-transform">
                          <Radio className="h-3 w-3 text-blue-600" />
                        </div>
                        {/* Hover Tooltip */}
                        <div className="hidden group-hover:block absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 font-mono text-[9px] text-white z-30 border border-zinc-700">
                          <strong>{ap.name}</strong> • {ap.connectedDeviceCount} devices
                        </div>
                      </div>
                    ))}
                </div>

                {/* Heatmap Legend */}
                <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-zinc-400 border-t border-zinc-800 pt-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold uppercase text-zinc-300">Thermal Scale:</span>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded-full bg-emerald-500" />
                      <span>&lt;60% Optimal</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded-full bg-amber-500" />
                      <span>60-85% Busy</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded-full bg-rose-600 animate-pulse" />
                      <span>&gt;100% Fire Hazard</span>
                    </div>
                  </div>

                  <span>Anonymized WiFi probe telemetry (MAC SHA-256)</span>
                </div>
              </div>
            </div>

            {/* Right Col: Zone Inspector & Broadcast Audit Drawer (4 cols) */}
            <div className="space-y-4 lg:col-span-4">
              {/* Selected Zone Card */}
              <div className="neu-border bg-white p-4 dark:bg-zinc-900">
                <h4 className="font-mono text-xs font-black uppercase text-zinc-500 mb-2">
                  Zone Safety & Dwell Inspector
                </h4>

                {selectedZone ? (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
                      <h3 className="font-black text-sm text-zinc-900 dark:text-white">
                        {selectedZone.name}
                      </h3>
                      <span
                        className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${
                          selectedZone.safetyStatus === "critical_fire_hazard"
                            ? "bg-rose-600 text-white"
                            : selectedZone.safetyStatus === "moderate_yellow"
                            ? "bg-amber-300 text-black"
                            : "bg-emerald-200 text-emerald-900"
                        }`}
                      >
                        {selectedZone.safetyStatus.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between font-bold text-zinc-700 dark:text-zinc-300">
                          <span>Occupancy:</span>
                          <span>
                            {selectedZone.currentOccupancyCount} / {selectedZone.maxFireCodeCapacity} (
                            {selectedZone.occupancyPercentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden dark:bg-zinc-800 mt-1">
                          <div
                            className={`h-full rounded-full ${
                              selectedZone.occupancyPercentage >= 100
                                ? "bg-rose-600 animate-pulse"
                                : selectedZone.occupancyPercentage >= 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, selectedZone.occupancyPercentage)}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div className="neu-border bg-zinc-50 p-2 dark:bg-zinc-800">
                          <span className="text-zinc-500 text-[9px]">Ingress Flow</span>
                          <p className="font-bold text-emerald-600">+{selectedZone.ingressRatePerMin}/min</p>
                        </div>
                        <div className="neu-border bg-zinc-50 p-2 dark:bg-zinc-800">
                          <span className="text-zinc-500 text-[9px]">Egress Flow</span>
                          <p className="font-bold text-zinc-700 dark:text-zinc-300">
                            -{selectedZone.egressRatePerMin}/min
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedZone.safetyStatus === "critical_fire_hazard" && (
                      <Button
                        onClick={() => {
                          setActiveSurgeAlert(
                            surgeAlerts.find((a) => a.zoneId === selectedZone.id) || null
                          );
                          setIsBroadcastModalOpen(true);
                        }}
                        className="neu-border w-full bg-rose-600 font-mono text-xs font-black uppercase text-white hover:bg-rose-700"
                      >
                        <Bell className="h-3.5 w-3.5 mr-1" /> Dispatch Redirection Notification
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500 font-mono text-xs">
                    <MapPin className="h-6 w-6 mx-auto mb-2 text-zinc-400" />
                    <span>Click any Gymnasium on the floorplan to inspect live telemetry.</span>
                  </div>
                )}
              </div>

              {/* Recent Broadcast Log */}
              <div className="neu-border bg-white p-4 dark:bg-zinc-900">
                <h4 className="font-mono text-xs font-black uppercase text-zinc-500 mb-2">
                  Recent Push Broadcasts ({broadcastLog.length})
                </h4>

                {broadcastLog.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {broadcastLog.map((bc) => (
                      <div
                        key={bc.id}
                        className="neu-border bg-zinc-50 p-2.5 font-mono text-[11px] dark:bg-zinc-800"
                      >
                        <div className="flex justify-between font-bold">
                          <span className="text-zinc-900 dark:text-white truncate">{bc.title}</span>
                          <span className="text-emerald-600">~{bc.convertedRedirectionCount} moved</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
                          {bc.notificationMessage}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-mono text-xs text-zinc-400">
                    No active crowd redirect notifications sent yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Emergency Egress Modeler */}
        <TabsContent value="egress_simulator" className="mt-4">
          <VenueEgressSimulatorPanel zones={zones} />
        </TabsContent>
      </Tabs>

      {/* Push Notification Broadcast Modal */}
      <CrowdRedirectNotificationModal
        alert={activeSurgeAlert}
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
        onBroadcastDispatched={handleBroadcastSuccess}
      />
    </div>
  );
};

export default InteractiveVenueThermalMap;
