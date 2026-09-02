import React, { useEffect, useRef, useState, useCallback } from "react";
import Play from "lucide-react/dist/esm/icons/play";
import Pause from "lucide-react/dist/esm/icons/pause";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Users from "lucide-react/dist/esm/icons/users";
import Activity from "lucide-react/dist/esm/icons/activity";

import { CrowdSimulationEngine } from "@/lib/crowdSimulation/crowdSimulationEngine";
import { BottleneckState, CrowdSimConfig } from "@/lib/crowdSimulation/crowdSimulationTypes";

interface LayoutItem {
  id: string;
  type?: string;
  kind?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

interface CrowdSimulationOverlayProps {
  layoutElements: LayoutItem[];
  width?: number;
  height?: number;
  onClose?: () => void;
}

export const CrowdSimulationOverlay: React.FC<CrowdSimulationOverlayProps> = ({
  layoutElements,
  width = 800,
  height = 600,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CrowdSimulationEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [capacity, setCapacity] = useState<number>(150);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [bottleneckState, setBottleneckState] = useState<BottleneckState>({
    detected: false,
    zoneId: null,
    zoneLabel: null,
    density: 0,
    recommendation: null,
    contributingNodeLabel: null,
  });

  // Initialize Simulation Engine
  useEffect(() => {
    const engine = new CrowdSimulationEngine({
      canvasWidth: width,
      canvasHeight: height,
      maxCapacity: capacity,
    });

    engine.loadFromLayoutElements(layoutElements);
    engineRef.current = engine;

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height]);

  // Update elements when layout props change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.loadFromLayoutElements(layoutElements);
    }
  }, [layoutElements]);

  // Update engine capacity when slider moves
  const handleCapacityChange = (newCapacity: number) => {
    setCapacity(newCapacity);
    if (engineRef.current) {
      engineRef.current.setConfig({ maxCapacity: newCapacity });
    }
  };

  // Main Render & Animation Loop
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine || typeof canvas.getContext !== "function") return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05); // cap delta time
    lastTimeRef.current = now;

    // Step simulation engine
    engine.step(dt);

    // Sync UI states
    setActiveCount(engine.getActiveCount());
    const bState = engine.getBottleneckState();
    setBottleneckState(bState);

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    const nodes = engine.getNodes();
    const exitNodes = nodes.filter((n) => n.type === "exit");

    // Draw Exit Danger Heatmap / Critical Bottleneck Zone Overlays
    if (exitNodes.length > 0) {
      for (const exit of exitNodes) {
        const cx = exit.x + exit.width / 2;
        const cy = exit.y + exit.height / 2;
        const radius = 80;

        const isCriticalZone = bState.detected && (bState.zoneId === exit.id || !bState.zoneId);

        // Draw density pulse circle
        const gradient = ctx.createRadialGradient(cx, cy, 5, cx, cy, radius);
        if (isCriticalZone) {
          gradient.addColorStop(0, "rgba(239, 68, 68, 0.6)");
          gradient.addColorStop(0.7, "rgba(239, 68, 68, 0.25)");
          gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
        } else {
          gradient.addColorStop(0, "rgba(59, 130, 246, 0.25)");
          gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        if (isCriticalZone) {
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Draw Particles (Crowd People)
    const particles = engine.getParticles();
    ctx.fillStyle = "#0284c7"; // Sky blue particles

    for (let i = 0; i < 500; i++) {
      const idx = i * 6;
      if (particles[idx + 4] === 0) continue; // Inactive

      const px = particles[idx];
      const py = particles[idx + 1];
      const vx = particles[idx + 2];
      const vy = particles[idx + 3];

      // Draw particle body
      ctx.fillStyle = bState.detected ? "#dc2626" : "#2563eb";
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      // Velocity trail
      ctx.strokeStyle = bState.detected ? "rgba(239, 68, 68, 0.4)" : "rgba(59, 130, 246, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - vx * 0.15, py - vy * 0.15);
      ctx.stroke();
    }

    if (engine.getIsRunning()) {
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    }
  }, [width, height]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!engineRef.current) return;

    if (isPlaying) {
      engineRef.current.pause();
      setIsPlaying(false);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      engineRef.current.start();
      setIsPlaying(true);
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    }
  };

  // Handle Reset
  const handleReset = () => {
    if (!engineRef.current) return;
    engineRef.current.reset();
    setIsPlaying(false);
    setActiveCount(0);
    setBottleneckState({
      detected: false,
      zoneId: null,
      zoneLabel: null,
      density: 0,
      recommendation: null,
      contributingNodeLabel: null,
    });

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Render single frame to clear particles from view
    const canvas = canvasRef.current;
    if (canvas && typeof canvas.getContext === "function") {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, width, height);
    }
  };

  return (
    <div className="relative w-full space-y-4">
      {/* Critical Bottleneck Alert Banner */}
      {bottleneckState.detected && (
        <div
          role="alert"
          data-testid="critical-bottleneck-alert"
          className="border-4 border-red-600 bg-red-950 p-4 text-white shadow-[4px_4px_0_0_#000] animate-pulse flex items-start gap-3"
        >
          <AlertTriangle className="h-8 w-8 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-display text-lg font-black uppercase tracking-wider text-red-200">
              CRITICAL BOTTLE NECK DETECTED
            </h3>
            <p className="font-mono text-sm font-bold text-amber-300">
              {bottleneckState.recommendation || "Move the Food Table."}
            </p>
            <p className="font-mono text-xs text-red-300">
              Crowd density around {bottleneckState.zoneLabel || "Exit"} exceeded critical threshold
              ({(bottleneckState.density * 1000).toFixed(1)} people/kpx²).
            </p>
          </div>
        </div>
      )}

      {/* Simulation Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-white p-3 shadow-[3px_3px_0_0_#000]">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            data-testid="sim-toggle-play"
            className={`flex items-center gap-1.5 border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
              isPlaying ? "bg-amber-300 hover:bg-amber-400" : "bg-lime hover:bg-emerald-400"
            }`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? "Pause" : "Start Simulation"}
          </button>

          <button
            onClick={handleReset}
            data-testid="sim-reset"
            className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:bg-cream active:translate-x-0.5 active:translate-y-0.5"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>

        {/* Capacity Slider Control */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="flex items-center gap-1 font-bold uppercase">
            <Users size={14} /> Crowd Capacity:
          </span>
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={capacity}
            onChange={(e) => handleCapacityChange(Number(e.target.value))}
            data-testid="sim-capacity-slider"
            className="w-32 accent-black cursor-pointer"
          />
          <span className="w-12 font-bold">{capacity} max</span>
        </div>

        {/* Active Telemetry */}
        <div className="flex items-center gap-2 font-mono text-xs bg-gray-100 border border-black px-2.5 py-1">
          <Activity size={13} className="text-blue-600" />
          <span>
            Active: {activeCount} / {capacity}
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="border border-black bg-gray-200 px-2 py-1 font-mono text-xs font-bold hover:bg-gray-300"
          >
            ✕ Close Overlay
          </button>
        )}
      </div>

      {/* Canvas Layer */}
      <div
        className="relative border-4 border-black bg-slate-900/10 shadow-[4px_4px_0_0_#000] overflow-hidden"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          data-testid="crowd-simulation-canvas"
          className="absolute inset-0 pointer-events-none z-30"
        />
      </div>
    </div>
  );
};
