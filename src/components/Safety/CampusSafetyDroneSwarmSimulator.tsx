import React, { useEffect, useRef, useState, useCallback } from "react";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import Radio from "lucide-react/dist/esm/icons/radio";
import Play from "lucide-react/dist/esm/icons/play";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Users from "lucide-react/dist/esm/icons/users";
import Navigation from "lucide-react/dist/esm/icons/navigation";
import Activity from "lucide-react/dist/esm/icons/activity";
import Zap from "lucide-react/dist/esm/icons/zap";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";

import {
  DroneSwarmSimulationEngine,
  DroneSwarmSimulationState,
} from "@/lib/campusSafety/droneSwarmSimulationEngine";

interface CampusSafetyDroneSwarmSimulatorProps {
  width?: number;
  height?: number;
}

export const CampusSafetyDroneSwarmSimulator: React.FC<CampusSafetyDroneSwarmSimulatorProps> = ({
  width = 640,
  height = 460,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<DroneSwarmSimulationEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const [simState, setSimState] = useState<DroneSwarmSimulationState | null>(null);

  // Initialize engine
  useEffect(() => {
    const engine = new DroneSwarmSimulationEngine(width, height);
    engineRef.current = engine;
    setSimState(engine.getState());

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height]);

  // Main Render & Step Animation Loop
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = now;

    // Step physics & simulation logic
    engine.step(dt);
    const state = engine.getState();
    setSimState(state);

    // Clear background
    ctx.fillStyle = "#0f172a"; // slate-900
    ctx.fillRect(0, 0, width, height);

    // Draw campus grid lines
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 1. Draw High-Density Student Safety Zones
    state.studentZones.forEach((zone) => {
      ctx.fillStyle =
        zone.density === "HIGH" ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.1)";
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);

      ctx.strokeStyle = zone.density === "HIGH" ? "rgba(245, 158, 11, 0.5)" : "#334155";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

      // Label & Student Count Badge
      ctx.fillStyle = zone.density === "HIGH" ? "#fde047" : "#94a3b8";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText(zone.name, zone.x + 6, zone.y + 16);
      ctx.font = "9px monospace";
      ctx.fillText(`👥 ${zone.studentCount} students`, zone.x + 6, zone.y + 30);
    });

    // 2. Draw Simulated Response / Decoy Zone
    if (state.responseZoneActive && state.responseZoneCenter) {
      const cx = state.responseZoneCenter.x;
      const cy = state.responseZoneCenter.y;
      const radius = state.responseZoneRadius;

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, "rgba(6, 182, 212, 0.45)"); // Cyan decoy glow
      gradient.addColorStop(0.7, "rgba(6, 182, 212, 0.2)");
      gradient.addColorStop(1, "rgba(6, 182, 212, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing dotted border
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#06b6d4";
      ctx.font = "bold 9px monospace";
      ctx.fillText("SIMULATED DECOY ZONE", cx - 50, cy - radius - 6);
    }

    // 3. Draw Simulated Threat Position & Vector
    const threat = state.threat;
    const isRedirected = threat.status === "REDIRECTED";

    // Threat trajectory ray line
    ctx.beginPath();
    ctx.strokeStyle = isRedirected ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(threat.x, threat.y);
    ctx.lineTo(threat.x + threat.vx * 6, threat.y + threat.vy * 6);
    ctx.stroke();
    ctx.setLineDash([]);

    // Threat hazard radius glow
    const threatGlow = ctx.createRadialGradient(
      threat.x,
      threat.y,
      0,
      threat.x,
      threat.y,
      threat.radius,
    );
    threatGlow.addColorStop(0, isRedirected ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)");
    threatGlow.addColorStop(1, "rgba(239, 68, 68, 0)");

    ctx.fillStyle = threatGlow;
    ctx.beginPath();
    ctx.arc(threat.x, threat.y, threat.radius, 0, Math.PI * 2);
    ctx.fill();

    // Threat pin marker
    ctx.fillStyle = isRedirected ? "#22c55e" : "#ef4444";
    ctx.beginPath();
    ctx.arc(threat.x, threat.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px monospace";
    ctx.fillText("THREAT", threat.x - 18, threat.y + 18);

    // 4. Draw Simulated 3-Drone Swarm & Response Routes
    state.drones.forEach((drone) => {
      // Draw Drone route waypoints line
      if (drone.routeWaypoints.length > 1 && drone.status !== "available") {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);

        drone.routeWaypoints.forEach((wp, idx) => {
          if (idx === 0) ctx.moveTo(wp.x, wp.y);
          else ctx.lineTo(wp.x, wp.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Drone Body Icon
      ctx.fillStyle =
        drone.status === "deployed"
          ? "#06b6d4"
          : drone.status === "deploying"
            ? "#38bdf8"
            : "#94a3b8";
      ctx.beginPath();
      ctx.arc(drone.x, drone.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Drone Rotor blades visual indicator
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(drone.x - 9, drone.y);
      ctx.lineTo(drone.x + 9, drone.y);
      ctx.moveTo(drone.x, drone.y - 9);
      ctx.lineTo(drone.x, drone.y + 9);
      ctx.stroke();

      // Drone Label
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "9px monospace";
      ctx.fillText(drone.name, drone.x - 16, drone.y - 10);
    });

    if (engine.getState().simulationStatus === "DEPLOYED") {
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    }
  }, [width, height]);

  // Deploy Action Trigger
  const handleDeploySimulation = () => {
    if (!engineRef.current) return;
    engineRef.current.deploy();
    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(renderFrame);
  };

  // Reset Action Trigger
  const handleResetSimulation = () => {
    if (!engineRef.current) return;
    engineRef.current.reset();
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    const state = engineRef.current.getState();
    setSimState(state);

    // Initial render frame draw
    const canvas = canvasRef.current;
    if (canvas && typeof canvas.getContext === "function") {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, width, height);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Critical Safety Alert Banner */}
      {simState?.criticalAlert && simState.criticalAlertMessage && (
        <div
          role="alert"
          data-testid="critical-safety-alert-banner"
          className="border-4 border-rose-600 bg-rose-950 p-4 text-white rounded-xl shadow-[4px_4px_0_0_#000] space-y-2 animate-pulse"
        >
          <div className="flex items-center gap-2 text-rose-300 font-extrabold text-sm uppercase tracking-wider border-b border-rose-800 pb-2">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <span>CRITICAL SAFETY ALERT</span>
          </div>
          <p className="font-mono text-xs text-rose-100 font-bold whitespace-pre-line">
            Simulated threat trajectory intersects a high-density area.
          </p>
          <p className="font-mono text-xs text-amber-300 font-bold">
            Recommended action: Maintain lockdown and await emergency response.
          </p>
        </div>
      )}

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-800 bg-slate-900 p-3 rounded-xl shadow-lg text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={handleDeploySimulation}
            disabled={simState?.simulationStatus === "DEPLOYED"}
            data-testid="deploy-safety-sim-btn"
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-mono font-bold uppercase transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            Deploy Safety Simulation
          </button>

          <button
            onClick={handleResetSimulation}
            data-testid="reset-safety-sim-btn"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-mono font-bold uppercase border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>

        <div className="flex items-center gap-2 text-slate-400 font-mono">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>Simulation Engine: Active</span>
        </div>
      </div>

      {/* Main Simulation View & Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Canvas Area */}
        <div className="lg:col-span-2 relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            data-testid="drone-swarm-canvas"
            className="w-full h-full object-cover block"
          />

          {/* Decoy Zone Legend Tag */}
          {simState?.responseZoneActive && (
            <div className="absolute top-3 left-3 bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 font-mono text-[10px] px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span>SIMULATED RESPONSE ZONE: ACTIVE</span>
            </div>
          )}
        </div>

        {/* Simulation Timeline & Status Panel */}
        <div
          data-testid="simulation-status-panel"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> SAFETY SIMULATION
            </h4>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
              VIRTUAL
            </span>
          </div>

          <div className="space-y-2 text-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Threat Status:</span>
              <span className="font-bold text-rose-400">
                {simState?.threat.status || "DETECTED"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Student Risk Zone:</span>
              <span
                className={`font-bold ${simState?.criticalAlert ? "text-amber-400" : "text-emerald-400"}`}
              >
                {simState?.criticalAlert ? "HIGH" : "SAFE"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Drone Simulation:</span>
              <span className="font-bold text-cyan-400">
                {simState?.simulationStatus || "AVAILABLE"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Response Zone:</span>
              <span
                className={`font-bold ${simState?.responseZoneActive ? "text-cyan-400" : "text-slate-500"}`}
              >
                {simState?.responseZoneActive ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          </div>

          {/* Drones Status Breakdown */}
          <div className="border-t border-slate-800 pt-3 space-y-2">
            <p className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">
              3-Drone Swarm Telemetry
            </p>

            {simState?.drones.map((drone) => (
              <div
                key={drone.id}
                data-testid={`drone-status-${drone.id}`}
                className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800/80 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-bold text-slate-200">{drone.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      drone.status === "deployed"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : drone.status === "deploying"
                          ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                          : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {drone.status === "deploying" ? "En Route" : drone.status}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {drone.batteryPercent.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
