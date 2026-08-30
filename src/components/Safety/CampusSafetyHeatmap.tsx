/**
 * Interactive Campus Safety Heatmap Component
 * Renders dynamic Red/Yellow/Green safety density contours, infrastructure nodes,
 * incident markers, and interactive Safe Route Polyline overlays.
 * Issue #4139
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  SafetyReport,
  GeoLocationPoint,
  SafeRouteComparison,
  CampusInfrastructureNode,
  SafetyZoneRisk,
} from '../../types/campusSafety';
import {
  Shield,
  AlertTriangle,
  Flame,
  Lightbulb,
  PhoneCall,
  Navigation,
  Layers,
  Eye,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { calculateHaversineDistance } from '../../lib/campusSafetyRouting';

interface CampusSafetyHeatmapProps {
  reports: SafetyReport[];
  infrastructure: CampusInfrastructureNode[];
  heatmapGrid: SafetyZoneRisk[];
  safestRoute?: SafeRouteComparison | null;
  shortestRoute?: SafeRouteComparison | null;
  origin?: GeoLocationPoint | null;
  destination?: GeoLocationPoint | null;
  onMapClick?: (point: GeoLocationPoint) => void;
  onReportClick?: (report: SafetyReport) => void;
}

export const CampusSafetyHeatmap: React.FC<CampusSafetyHeatmapProps> = ({
  reports,
  infrastructure,
  heatmapGrid,
  safestRoute,
  shortestRoute,
  origin,
  destination,
  onMapClick,
  onReportClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showSafeRoute, setShowSafeRoute] = useState(true);
  const [showShortestRoute, setShowShortestRoute] = useState(true);
  const [showInfrastructure, setShowInfrastructure] = useState(true);
  const [selectedReport, setSelectedReport] = useState<SafetyReport | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; text: string } | null>(null);

  // Map coordinate boundary projection
  const bounds = {
    minLat: 40.712,
    maxLat: 40.722,
    minLng: -74.012,
    maxLng: -74.002,
  };

  // Convert geo coordinates (lat, lng) to canvas pixels (x, y)
  const projectGeoToPixel = (
    lat: number,
    lng: number,
    width: number,
    height: number
  ) => {
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * width;
    const y =
      height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;
    return { x, y };
  };

  const projectPixelToGeo = (
    x: number,
    y: number,
    width: number,
    height: number
  ): GeoLocationPoint => {
    const lng = bounds.minLng + (x / width) * (bounds.maxLng - bounds.minLng);
    const lat =
      bounds.maxLat - (y / height) * (bounds.maxLat - bounds.minLat);
    return { latitude: lat, longitude: lng };
  };

  // Canvas render loop for dynamic heatmap, contours, and routes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background: dark aesthetic night-mode campus map style
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, width, height);

    // Draw campus grid lines & paths
    ctx.strokeStyle = '#1e293b';
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

    // Draw stylized campus buildings / landmarks
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;

    const buildings = [
      { x: 120, y: 100, w: 90, h: 70, label: 'Engineering Hall' },
      { x: 320, y: 140, w: 110, h: 85, label: 'Science Complex' },
      { x: 200, y: 280, w: 130, h: 90, label: 'Student Center' },
      { x: 450, y: 320, w: 100, h: 75, label: 'Main Library' },
      { x: 80, y: 380, w: 80, h: 60, label: 'Athletic Field' },
    ];

    buildings.forEach((b) => {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(b.label, b.x + 6, b.y + 18);
    });

    // 1. Draw Heatmap Layer (Red / Yellow / Green intensity gradients)
    if (showHeatmap && reports.length > 0) {
      reports.forEach((report) => {
        const { x, y } = projectGeoToPixel(
          report.latitude,
          report.longitude,
          width,
          height
        );

        let radius = 65;
        let colorStop0 = 'rgba(239, 68, 68, 0.65)'; // Red critical
        let colorStop1 = 'rgba(245, 158, 11, 0.35)'; // Yellow
        let colorStop2 = 'rgba(239, 68, 68, 0.0)';

        if (report.severity === 'medium') {
          radius = 50;
          colorStop0 = 'rgba(245, 158, 11, 0.55)';
          colorStop1 = 'rgba(234, 179, 8, 0.25)';
        } else if (report.severity === 'low') {
          radius = 35;
          colorStop0 = 'rgba(234, 179, 8, 0.4)';
          colorStop1 = 'rgba(16, 185, 129, 0.15)';
        }

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, colorStop0);
        gradient.addColorStop(0.6, colorStop1);
        gradient.addColorStop(1, colorStop2);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 2. Draw Infrastructure POIs (Blue light boxes, high-intensity lights)
    if (showInfrastructure) {
      infrastructure.forEach((infra) => {
        const { x, y } = projectGeoToPixel(
          infra.latitude,
          infra.longitude,
          width,
          height
        );

        // Halo glow for lights
        if (infra.infrastructure_type === 'high_intensity_lighting') {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, 32);
          glow.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
          glow.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, 32, 0, Math.PI * 2);
          ctx.fill();
        }

        // Blue light emergency box marker
        ctx.fillStyle =
          infra.infrastructure_type === 'emergency_callbox'
            ? '#3b82f6'
            : '#0284c7';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // 3. Draw Standard Shortest Route (Red/Yellow dotted hazard path)
    if (showShortestRoute && shortestRoute && shortestRoute.waypoints.length > 1) {
      ctx.beginPath();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = '#ef4444'; // Red dash
      ctx.lineWidth = 3.5;

      shortestRoute.waypoints.forEach((wp, idx) => {
        const { x, y } = projectGeoToPixel(wp.latitude, wp.longitude, width, height);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Draw Safest Safe-Corridor Route (Glowing Green Solid Path)
    if (showSafeRoute && safestRoute && safestRoute.waypoints.length > 1) {
      // Glow underlay
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 9;
      safestRoute.waypoints.forEach((wp, idx) => {
        const { x, y } = projectGeoToPixel(wp.latitude, wp.longitude, width, height);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Sharp green core line
      ctx.beginPath();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      safestRoute.waypoints.forEach((wp, idx) => {
        const { x, y } = projectGeoToPixel(wp.latitude, wp.longitude, width, height);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // 5. Draw Incident Hazard Pins
    reports.forEach((report) => {
      const { x, y } = projectGeoToPixel(
        report.latitude,
        report.longitude,
        width,
        height
      );

      ctx.fillStyle =
        report.severity === 'critical'
          ? '#dc2626'
          : report.severity === 'high'
          ? '#ea580c'
          : '#ca8a04';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Exclamation glyph
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('!', x - 2, y + 3);
    });

    // 6. Draw Origin & Destination Pins
    if (origin) {
      const { x, y } = projectGeoToPixel(
        origin.latitude,
        origin.longitude,
        width,
        height
      );
      ctx.fillStyle = '#3b82f6'; // Blue
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('A', x - 4, y + 4);
    }

    if (destination) {
      const { x, y } = projectGeoToPixel(
        destination.latitude,
        destination.longitude,
        width,
        height
      );
      ctx.fillStyle = '#10b981'; // Green
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('B', x - 4, y + 4);
    }
  }, [
    reports,
    infrastructure,
    heatmapGrid,
    safestRoute,
    shortestRoute,
    origin,
    destination,
    showHeatmap,
    showSafeRoute,
    showShortestRoute,
    showInfrastructure,
  ]);

  // Handle canvas click to set origin/dest or select report
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked an incident pin
    for (const report of reports) {
      const p = projectGeoToPixel(
        report.latitude,
        report.longitude,
        canvas.width,
        canvas.height
      );
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist <= 14) {
        setSelectedReport(report);
        if (onReportClick) onReportClick(report);
        return;
      }
    }

    // Otherwise trigger map coordinate click
    const geo = projectPixelToGeo(x, y, canvas.width, canvas.height);
    if (onMapClick) {
      onMapClick(geo);
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl">
      {/* Map Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-800/90 backdrop-blur border-b border-slate-700">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-slate-100 text-sm md:text-base">
            Live Campus Safety Heatmap & Dynamic Safe-Walk
          </h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Real-Time Penalizer
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition ${
              showHeatmap
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-700 text-slate-400 border-slate-600'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Heatmap Overlay</span>
          </button>

          <button
            onClick={() => setShowSafeRoute(!showSafeRoute)}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition ${
              showSafeRoute
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-700 text-slate-400 border-slate-600'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Safe Corridor</span>
          </button>

          <button
            onClick={() => setShowInfrastructure(!showInfrastructure)}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition ${
              showInfrastructure
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : 'bg-slate-700 text-slate-400 border-slate-600'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Blue Light POIs</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div className="relative w-full h-[460px] cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={640}
          height={460}
          onClick={handleCanvasClick}
          className="w-full h-full object-cover block"
        />

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur p-3 rounded-xl border border-slate-700/80 text-xs text-slate-300 space-y-1.5 shadow-lg max-w-[210px]">
          <div className="font-semibold text-slate-100 flex items-center space-x-1.5 pb-1 border-b border-slate-800">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Safety Heatmap Legend</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Red: High Hazard Zone</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Yellow: Caution Area</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Green: Safe Corridor</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>Blue: 24/7 Callbox</span>
            </span>
          </div>
        </div>

        {/* Selected Incident Drawer */}
        {selectedReport && (
          <div className="absolute top-3 right-3 max-w-sm bg-slate-900/95 backdrop-blur border border-rose-500/40 p-4 rounded-xl shadow-2xl text-xs space-y-2 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-1.5 text-rose-400 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span className="capitalize">
                  {selectedReport.report_type.replace(/_/g, ' ')}
                </span>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-300">{selectedReport.description}</p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-slate-400">
              <span className="capitalize font-mono">
                Severity: {selectedReport.severity}
              </span>
              <span>
                {new Date(selectedReport.incident_timestamp).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
