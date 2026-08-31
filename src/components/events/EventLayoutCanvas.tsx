import React, { useState, useRef, useEffect } from "react";
import { Wifi, Router, AlertTriangle, Cpu, GripHorizontal } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const EventLayoutCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Mock AP data ingested from Meraki
  const accessPoints = [
    { id: 1, x: 20, y: 30, radius: 30 },
    { id: 2, x: 80, y: 40, radius: 30 },
  ];

  // Draggable operational hardware
  const [hardware, setHardware] = useState([
    { id: "kiosk-1", type: "Check-In Kiosk", x: 50, y: 50, isDragging: false, isCritical: false },
  ]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Collision Math (Distance formula)
  const calculateRSSI = (x: number, y: number) => {
    let maxSignal = 0;
    for (const ap of accessPoints) {
      // Basic euclidean distance in percentage space
      const dist = Math.sqrt(Math.pow(ap.x - x, 2) + Math.pow(ap.y - y, 2));
      // Signal decays linearly for this mock (radius = max distance)
      const signal = Math.max(0, 100 - (dist / ap.radius) * 100);
      if (signal > maxSignal) maxSignal = signal;
    }
    return maxSignal;
  };

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    setHardware((prev) => prev.map((h) => (h.id === id ? { ...h, isDragging: true } : h)));
    // Capture pointer to document to track outside bounds
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const draggingHardware = hardware.find((h) => h.isDragging);
    if (!draggingHardware || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();

    // Calculate percentage position
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    // Constrain to canvas
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    const signal = calculateRSSI(x, y);
    const isCritical = signal < 20; // Critical Dead Zone threshold

    setHardware((prev) => prev.map((h) => (h.isDragging ? { ...h, x, y, isCritical } : h)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setHardware((prev) => prev.map((h) => ({ ...h, isDragging: false })));
  };

  const criticalCount = hardware.filter((h) => h.isCritical).length;

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Wifi className="h-8 w-8 text-emerald-500" />
            Operational Layout & Infrastructure Overlay
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm max-w-3xl leading-relaxed">
            2D Canvas overlaid with real-time Cisco Meraki AP telemetry. Drag operational hardware
            (Check-in Kiosks) into position. Red zones indicate complete network blackout.
          </p>
        </div>
        <Button className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
          <Router className="mr-2 h-4 w-4 text-emerald-400" /> Sync Meraki APs
        </Button>
      </div>

      {criticalCount > 0 && (
        <div className="bg-red-950/50 border-2 border-red-900 rounded-lg p-4 flex items-center gap-4 animate-in slide-in-from-top">
          <AlertTriangle className="h-8 w-8 text-red-500 shrink-0" />
          <div>
            <h3 className="text-red-500 font-bold text-lg">
              CRITICAL OPERATIONAL FAILURE DETECTED
            </h3>
            <p className="text-red-300 text-sm font-mono mt-1">
              {criticalCount} piece(s) of mission-critical hardware have been placed in a complete
              Network Dead Zone (Red). Check-in apps and POS Terminals will fail to load. Relocate
              them immediately.
            </p>
          </div>
        </div>
      )}

      {/* The 2D Canvas */}
      <Card className="bg-slate-950 border-slate-800 shadow-2xl relative overflow-hidden">
        <CardHeader className="py-3 border-b border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-slate-300 text-sm font-mono flex items-center gap-2">
            Main Auditorium Basement Layout
          </CardTitle>
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            RSSI Heatmap Active
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div
            ref={canvasRef}
            className="w-full h-[600px] relative bg-[#0a0a0f] overflow-hidden select-none touch-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{
              backgroundImage: "radial-gradient(circle at 2px 2px, #1e293b 1px, transparent 0)",
              backgroundSize: "40px 40px",
            }}
          >
            {/* Heatmap Overlay */}
            <div
              className="absolute inset-0 opacity-40 pointer-events-none mix-blend-screen"
              style={{
                background: "red", // Base layer is a dead zone
                maskImage: `radial-gradient(circle at ${accessPoints[0].x}% ${accessPoints[0].y}%, black, transparent ${accessPoints[0].radius * 2}%), radial-gradient(circle at ${accessPoints[1].x}% ${accessPoints[1].y}%, black, transparent ${accessPoints[1].radius * 2}%)`,
                WebkitMaskImage: `radial-gradient(circle at ${accessPoints[0].x}% ${accessPoints[0].y}%, black, transparent ${accessPoints[0].radius * 2}%), radial-gradient(circle at ${accessPoints[1].x}% ${accessPoints[1].y}%, black, transparent ${accessPoints[1].radius * 2}%)`,
                WebkitMaskComposite: "add",
              }}
            >
              <div className="absolute inset-0 bg-emerald-500"></div>
            </div>

            {/* Access Points Markers */}
            {accessPoints.map((ap) => (
              <div
                key={ap.id}
                className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${ap.x}%`, top: `${ap.y}%` }}
              >
                <div className="h-4 w-4 bg-emerald-400 rounded-full animate-ping absolute opacity-75"></div>
                <div className="h-3 w-3 bg-emerald-500 rounded-full z-10 border border-emerald-900 shadow-[0_0_15px_rgba(16,185,129,0.8)]"></div>
                <span className="mt-4 text-[10px] font-mono text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded shadow">
                  Meraki AP
                </span>
              </div>
            ))}

            {/* Hardware Items */}
            {hardware.map((hw) => (
              <div
                key={hw.id}
                onPointerDown={(e) => handlePointerDown(hw.id, e)}
                className={`absolute w-32 h-20 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 shadow-xl cursor-grab active:cursor-grabbing flex flex-col items-center justify-center transition-colors ${
                  hw.isCritical
                    ? "bg-red-950/80 border-red-500 z-50 animate-pulse"
                    : "bg-slate-800/80 border-slate-600 hover:border-slate-400 z-40"
                }`}
                style={{ left: `${hw.x}%`, top: `${hw.y}%` }}
              >
                {hw.isCritical ? (
                  <AlertTriangle className="h-6 w-6 text-red-500 mb-1" />
                ) : (
                  <Cpu className="h-6 w-6 text-slate-300 mb-1" />
                )}
                <span
                  className={`text-xs font-bold font-mono text-center px-2 ${hw.isCritical ? "text-red-400" : "text-slate-300"}`}
                >
                  {hw.type}
                </span>
                <div className="absolute -top-3 bg-slate-950 rounded px-1 border border-slate-700">
                  <GripHorizontal className="h-4 w-4 text-slate-500" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="bg-slate-950/80 border-t border-slate-800 p-4 text-xs font-mono text-slate-500 flex justify-between">
          <span>
            {hardware[0].isDragging
              ? "Drag to position hardware..."
              : "Select and drag hardware items on the canvas."}
          </span>
          <span>Canvas Bounds: 100m x 100m</span>
        </CardFooter>
      </Card>
    </div>
  );
};

export default EventLayoutCanvas;
