/**
 * Campus Safety Heatmap & Navigation Page
 * Route: /campus-safety
 * Issue #4139
 */

import React, { useState, useEffect } from "react";
import {
  SafetyReport,
  CampusInfrastructureNode,
  SafetyZoneRisk,
  GeoLocationPoint,
  SafeWalkRouteResult,
  SafetyReportInput,
} from "../types/campusSafety";
import { campusSafetyService } from "../services/campusSafetyService";
import { CampusSafetyHeatmap } from "../components/safety/CampusSafetyHeatmap";
import { AnonymousSafetyReportModal } from "../components/safety/AnonymousSafetyReportModal";
import { SafeWalkNavigationCard } from "../components/safety/SafeWalkNavigationCard";
import {
  ShieldAlert,
  AlertTriangle,
  PlusCircle,
  MapPin,
  RefreshCw,
  Search,
  CheckCircle,
  PhoneCall,
  Sliders,
  Radio,
} from "lucide-react";
import { CampusSafetyDroneSwarmSimulator } from "../components/safety/CampusSafetyDroneSwarmSimulator";

export default function CampusSafetyPage() {
  const [activeTab, setActiveTab] = useState<"heatmap" | "drone_sim">("heatmap");
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [infrastructure, setInfrastructure] = useState<CampusInfrastructureNode[]>([]);
  const [heatmapGrid, setHeatmapGrid] = useState<SafetyZoneRisk[]>([]);
  const [origin, setOrigin] = useState<GeoLocationPoint | null>({
    latitude: 40.714,
    longitude: -74.01,
    name: "Hackathon Lab / Engineering Hub",
  });
  const [destination, setDestination] = useState<GeoLocationPoint | null>({
    latitude: 40.72,
    longitude: -74.004,
    name: "North Residence Hall",
  });
  const [routeResult, setRouteResult] = useState<SafeWalkRouteResult | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<GeoLocationPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  // Load safety reports and infrastructure
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedReports, fetchedInfra, grid] = await Promise.all([
        campusSafetyService.fetchSafetyReports(),
        campusSafetyService.fetchInfrastructure(),
        campusSafetyService.getHeatmapGridData(),
      ]);
      setReports(fetchedReports);
      setInfrastructure(fetchedInfra);
      setHeatmapGrid(grid);

      if (origin && destination) {
        const plan = await campusSafetyService.getSafeRoutePlan(origin, destination);
        setRouteResult(plan);
      }
    } catch (err) {
      console.error("Failed to load safety data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update route plan when origin or destination changes
  useEffect(() => {
    if (origin && destination && reports.length > 0) {
      campusSafetyService.getSafeRoutePlan(origin, destination).then(setRouteResult);
    }
  }, [origin, destination, reports]);

  const handleMapClick = (point: GeoLocationPoint) => {
    setSelectedCoords(point);
    // If no origin set, set origin; else if no dest, set dest
    if (!origin) {
      setOrigin({ ...point, name: "Custom Origin" });
    } else if (!destination) {
      setDestination({ ...point, name: "Custom Destination" });
    } else {
      // Toggle destination
      setDestination({ ...point, name: "Selected Pin" });
    }
  };

  const handleCreateReport = async (input: SafetyReportInput): Promise<boolean> => {
    const res = await campusSafetyService.submitSafetyReport(input);
    if (res.success && res.report) {
      setReports((prev) => [res.report!, ...prev]);
      // Re-run safe route with updated hazard weightings
      if (origin && destination) {
        const updatedPlan = await campusSafetyService.getSafeRoutePlan(origin, destination);
        setRouteResult(updatedPlan);
      }
      return true;
    }
    return false;
  };

  const filteredReports = reports.filter((r) => {
    if (filterSeverity === "all") return true;
    return r.severity === filterSeverity;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Interactive Campus Safety Heatmap
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Dynamic walking route optimizer with hazard zone penalization & crowd-sourced
                incident reports.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <button
              onClick={() => setActiveTab("heatmap")}
              data-testid="tab-safety-heatmap"
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === "heatmap"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Safety Map & Navigation
            </button>
            <button
              onClick={() => setActiveTab("drone_sim")}
              data-testid="tab-drone-sim"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === "drone_sim"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Drone Swarm Decoy Simulation</span>
            </button>
          </div>

          <button
            onClick={() => {
              setSelectedCoords(origin || { latitude: 40.717, longitude: -74.007 });
              setIsReportModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/25 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report Hazard / Dark Zone</span>
          </button>

          <button
            onClick={loadData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition"
            title="Refresh Map Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {activeTab === "drone_sim" ? (
        <CampusSafetyDroneSwarmSimulator />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <CampusSafetyHeatmap
              reports={filteredReports}
              infrastructure={infrastructure}
              heatmapGrid={heatmapGrid}
              safestRoute={routeResult?.safest_route}
              shortestRoute={routeResult?.shortest_route}
              origin={origin}
              destination={destination}
              onMapClick={handleMapClick}
              onReportClick={(rep) =>
                setSelectedCoords({ latitude: rep.latitude, longitude: rep.longitude })
              }
            />

            {/* Quick presets */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">Popular Routes:</span>
              <button
                onClick={() => {
                  setOrigin({ latitude: 40.714, longitude: -74.01, name: "Hackathon Lab" });
                  setDestination({ latitude: 40.72, longitude: -74.004, name: "North Dorms" });
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
              >
                Late-Night Hackathon ➔ North Dorms
              </button>
              <button
                onClick={() => {
                  setOrigin({ latitude: 40.713, longitude: -74.009, name: "Library Quad" });
                  setDestination({ latitude: 40.719, longitude: -74.005, name: "Student Union" });
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
              >
                Library ➔ Student Union
              </button>
            </div>
          </div>

          {/* Right Sidebar: SafeWalk Navigation & Reports Feed */}
          <div className="space-y-5">
            <SafeWalkNavigationCard
              routeResult={routeResult}
              onEmergencyCall={() => {
                alert("Dialing Campus Safety & Escort Dispatch: 1-800-555-SAFE");
              }}
            />

            {/* Incident Feed & Filter */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Recent Safety Hazards ({filteredReports.length})</span>
                </h4>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none"
                >
                  <option value="all">All Severity</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {filteredReports.map((r) => (
                  <div
                    key={r.id}
                    onClick={() =>
                      setSelectedCoords({ latitude: r.latitude, longitude: r.longitude })
                    }
                    className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 transition cursor-pointer text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 capitalize">
                        {r.report_type.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.severity === "critical"
                            ? "bg-rose-500/20 text-rose-400"
                            : r.severity === "high"
                              ? "bg-orange-500/20 text-orange-400"
                              : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {r.severity}
                      </span>
                    </div>
                    <p className="text-slate-400 line-clamp-2">{r.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Anonymous Report Modal */}
      <AnonymousSafetyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmitReport={handleCreateReport}
        selectedCoordinates={selectedCoords}
      />
    </div>
  );
}
