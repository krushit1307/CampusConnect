import React, { useEffect, useState } from "react";
import {
  Volume2,
  VolumeX,
  Vibrate,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Sparkles,
  ArrowLeft,
  Eye,
  Shield,
  Zap,
  Activity,
  Play,
  Square,
  Compass,
} from "lucide-react";
import { acousticWayfindingController } from "@/services/acousticWayfindingController";
import { AcousticWayfindingState, SafeDirection } from "@/types/lidarWayfinding";
import { Link } from "react-router-dom";

export function AcousticWayfindingView() {
  const [state, setState] = useState<AcousticWayfindingState>(
    acousticWayfindingController.getState(),
  );
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [selectedDestination, setSelectedDestination] = useState("Main Keynote Stage");
  const [simulatedDistance, setSimulatedDistance] = useState<number | null>(null);
  const [simulatedOffset, setSimulatedOffset] = useState<number>(0); // -0.5 left, 0 center, +0.5 right

  useEffect(() => {
    const unsubscribe = acousticWayfindingController.subscribe((newState) => {
      setState(newState);
    });
    return () => {
      unsubscribe();
      acousticWayfindingController.stopNavigation();
    };
  }, []);

  const toggleNavigation = () => {
    if (state.isNavigating) {
      acousticWayfindingController.stopNavigation();
      setSimulatedDistance(null);
    } else {
      acousticWayfindingController.startNavigation(
        "venue_auditorium_1",
        "Grand Student Union Auditorium",
        selectedDestination,
        `Walk forward down Central Aisle towards ${selectedDestination}`,
      );
    }
  };

  const handleAudioConfigChange = (speech: boolean, haptics: boolean) => {
    setSpeechEnabled(speech);
    setHapticsEnabled(haptics);
    acousticWayfindingController.setAudioConfig({
      speechEnabled: speech,
      hapticsEnabled: haptics,
    });
  };

  const injectObstacle = (distance: number | null, offset: number = 0) => {
    setSimulatedDistance(distance);
    setSimulatedOffset(offset);
    acousticWayfindingController.injectSimulatedObstacle(distance, offset);
  };

  const getDirectionBadge = (direction?: SafeDirection) => {
    switch (direction) {
      case "left":
        return {
          label: "← MOVE LEFT TWO STEPS",
          color: "bg-amber-500 text-black border-amber-400",
        };
      case "right":
        return {
          label: "MOVE RIGHT TWO STEPS →",
          color: "bg-amber-500 text-black border-amber-400",
        };
      case "stop":
        return {
          label: "🛑 STOP IMMEDIATELY",
          color: "bg-red-600 text-white border-red-500 animate-bounce",
        };
      default:
        return {
          label: "↑ CONTINUE STRAIGHT",
          color: "bg-emerald-500 text-slate-950 border-emerald-400",
        };
    }
  };

  const badge = getDirectionBadge(state.activeObstacle?.recommendedDirection);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Screen Reader ARIA Live Announcer for Visually Impaired Users */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {state.safetyOverrideActive && state.activeObstacle
          ? state.activeObstacle.speechDescription
          : state.currentInstruction || "Acoustic Wayfinding ready."}
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <Link
              to="/map"
              className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Map
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Compass className="w-8 h-8 text-cyan-400 animate-pulse" />
              Event Layout Acoustic Wayfinding
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              LiDAR-Assisted Blind Obstacle Avoidance & Tactile Acoustic Guidance
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAudioConfigChange(!speechEnabled, hapticsEnabled)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                speechEnabled
                  ? "bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                  : "bg-slate-900 border-slate-700 text-slate-400"
              }`}
            >
              {speechEnabled ? (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
              Speech {speechEnabled ? "ON" : "OFF"}
            </button>

            <button
              onClick={() => handleAudioConfigChange(speechEnabled, !hapticsEnabled)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                hapticsEnabled
                  ? "bg-purple-950/80 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                  : "bg-slate-900 border-slate-700 text-slate-400"
              }`}
            >
              <Vibrate className="w-4 h-4 text-purple-400" />
              Haptics {hapticsEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* Safety Override Banner */}
        {state.safetyOverrideActive && (
          <div className="bg-red-950/90 border-2 border-red-500 text-white rounded-xl p-5 shadow-[0_0_25px_rgba(239,68,68,0.4)] animate-pulse flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-600 rounded-lg text-white font-bold text-xl">🚨</div>
              <div>
                <span className="text-xs uppercase font-extrabold tracking-widest text-red-300 bg-red-900/60 px-2 py-0.5 rounded border border-red-500/40">
                  LIDAR SAFETY OVERRIDE ACTIVE
                </span>
                <h2 className="text-xl font-black mt-1 text-red-100">
                  {state.activeObstacle?.speechDescription || "Hazard detected in walking path!"}
                </h2>
                <p className="text-xs text-red-200/80 mt-0.5">
                  Distance: {state.activeObstacle?.distanceMeters}m | Position:{" "}
                  {state.activeObstacle?.position} | Haptic Pulse: Active
                </p>
              </div>
            </div>

            <div
              className={`px-4 py-2 rounded-lg font-black text-sm border shadow-lg ${badge.color}`}
            >
              {badge.label}
            </div>
          </div>
        )}

        {/* Main Interface Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Navigation Controls */}
          <div className="md:col-span-1 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-cyan-400" /> Wayfinding Config
            </h3>

            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-medium">
                Select Event Layout Destination
              </label>
              <select
                disabled={state.isNavigating}
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="Main Keynote Stage">Main Keynote Stage (Auditorium A)</option>
                <option value="Accessible Restrooms">Accessible Restrooms (West Wing)</option>
                <option value="Sponsor Exhibition Hall">Sponsor Exhibition Hall (Booth 14)</option>
                <option value="Food & Catering Court">Food & Catering Court (South Exit)</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                onClick={toggleNavigation}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                  state.isNavigating
                    ? "bg-red-600 hover:bg-red-700 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                    : "bg-cyan-500 hover:bg-cyan-400 border-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                }`}
              >
                {state.isNavigating ? (
                  <>
                    <Square className="w-4 h-4 fill-current" /> Stop Acoustic Navigation
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Start Acoustic Wayfinding
                  </>
                )}
              </button>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>LiDAR Hardware:</span>
                <span
                  className={
                    state.lidarSupported ? "text-emerald-400 font-semibold" : "text-amber-400"
                  }
                >
                  {state.lidarSupported ? "Supported / Active" : "Simulated"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Scanning Mode:</span>
                <span
                  className={state.isLidarActive ? "text-cyan-400 font-semibold" : "text-slate-500"}
                >
                  {state.isLidarActive ? "150ms Stream" : "Idle"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Spatial Frustum:</span>
                <span>4.0m Forward Cone</span>
              </div>
            </div>

            {/* Interactive LiDAR Obstacle Simulator (Testing Panel) */}
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> LiDAR Test Obstacle Injector
              </span>
              <p className="text-[11px] text-slate-400">
                Inject simulated physical obstacles to verify acoustic warnings & haptic pulse
                override.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => injectObstacle(1.0, 0.4)}
                  className={`p-2 rounded border text-xs font-semibold transition-all ${
                    simulatedDistance === 1.0 && simulatedOffset > 0
                      ? "bg-amber-500 text-black border-amber-400 font-bold"
                      : "bg-slate-950 border-slate-700 text-slate-300 hover:border-amber-500/50"
                  }`}
                >
                  Right Hazard (1.0m)
                </button>
                <button
                  onClick={() => injectObstacle(1.1, -0.4)}
                  className={`p-2 rounded border text-xs font-semibold transition-all ${
                    simulatedDistance === 1.1 && simulatedOffset < 0
                      ? "bg-amber-500 text-black border-amber-400 font-bold"
                      : "bg-slate-950 border-slate-700 text-slate-300 hover:border-amber-500/50"
                  }`}
                >
                  Left Hazard (1.1m)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => injectObstacle(0.9, 0.0)}
                  className={`p-2 rounded border text-xs font-semibold transition-all ${
                    simulatedDistance === 0.9 && simulatedOffset === 0
                      ? "bg-red-600 text-white border-red-400 font-bold"
                      : "bg-slate-950 border-slate-700 text-slate-300 hover:border-red-500/50"
                  }`}
                >
                  Center Block (0.9m)
                </button>
                <button
                  onClick={() => injectObstacle(null)}
                  className="p-2 rounded border border-emerald-700 bg-emerald-950/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-900/60"
                >
                  Clear Path
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: LiDAR Radar Display & Navigation Status */}
          <div className="md:col-span-2 space-y-6">
            {/* Visual LiDAR Radar Scanner Frustum */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" /> LiDAR Spatial Frustum Radar
                </h3>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                  {state.isLidarActive ? "REALTIME SCANNING" : "STANDBY"}
                </span>
              </div>

              {/* Radar Grid Canvas Representation */}
              <div className="h-64 bg-slate-950 rounded-lg border border-slate-800 relative flex items-center justify-center overflow-hidden">
                {/* Concentric Frustum Distance Arcs */}
                <div className="absolute inset-0 flex items-end justify-center pointer-events-none pb-4">
                  <div className="w-56 h-56 rounded-full border border-dashed border-slate-800/80 absolute -bottom-28"></div>
                  <div className="w-40 h-40 rounded-full border border-dashed border-amber-900/40 absolute -bottom-20"></div>
                  <div className="w-24 h-24 rounded-full border border-dashed border-red-900/60 absolute -bottom-12"></div>
                </div>

                {/* Distance Labels */}
                <span className="absolute top-3 text-[10px] text-slate-600 font-mono">4.0m</span>
                <span className="absolute top-20 text-[10px] text-amber-500/70 font-mono">
                  3.0m Warning
                </span>
                <span className="absolute top-36 text-[10px] text-red-500/80 font-mono">
                  1.5m Immediate Hazard
                </span>

                {/* User Sensor Icon (Origin) */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_12px_#06b6d4]">
                    <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping"></div>
                  </div>
                  <span className="text-[10px] text-cyan-300 font-semibold mt-1">
                    USER (LiDAR Sensor)
                  </span>
                </div>

                {/* Active Obstacle Indicator on Radar */}
                {state.activeObstacle && (
                  <div
                    className={`absolute transition-all duration-300 flex flex-col items-center -translate-x-1/2 -translate-y-1/2 ${
                      state.activeObstacle.severity === "immediate_hazard"
                        ? "text-red-400"
                        : "text-amber-400"
                    }`}
                    style={{
                      bottom: `${Math.min(220, Math.max(40, (1 - state.activeObstacle.distanceMeters / 4.0) * 220))}px`,
                      left: `${50 + (state.activeObstacle.position === "right" ? 25 : state.activeObstacle.position === "left" ? -25 : 0)}%`,
                    }}
                  >
                    <div className="w-10 h-10 rounded-full bg-red-500/30 border-2 border-red-500 flex items-center justify-center animate-ping">
                      <AlertTriangle className="w-5 h-5 text-red-400 fill-red-500/20" />
                    </div>
                    <span className="text-[10px] font-bold bg-slate-900/90 border border-slate-700 px-1.5 py-0.5 rounded text-white mt-1 shadow">
                      {state.activeObstacle.distanceMeters}m ({state.activeObstacle.position})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Turn-by-Turn Wayfinding Telemetry */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Active Wayfinding Guidance
              </h3>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  Current Step
                </span>
                <p className="text-lg font-bold text-cyan-300 mt-1">
                  {state.currentInstruction || "Select a destination and start navigation."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Destination</span>
                  <p className="font-semibold text-slate-200 mt-0.5">
                    {state.targetDestination || "None"}
                  </p>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Hazard Status</span>
                  <p
                    className={`font-semibold mt-0.5 uppercase ${
                      state.hazardSeverity === "immediate_hazard"
                        ? "text-red-400"
                        : state.hazardSeverity === "warning"
                          ? "text-amber-400"
                          : "text-emerald-400"
                    }`}
                  >
                    {state.hazardSeverity.replace("_", " ")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AcousticWayfindingView;
