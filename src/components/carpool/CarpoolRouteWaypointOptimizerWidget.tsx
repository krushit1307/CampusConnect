import React, { useState } from "react";
import {
  Navigation,
  MapPin,
  Clock,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Zap,
  Car,
  Users,
  Compass,
  Sparkles,
} from "lucide-react";
import {
  CarpoolWaypoint,
  CarpoolRouteOptimizationRequest,
  CarpoolRouteOptimizationResult,
  processCarpoolRouteOptimization,
} from "@/lib/carpoolRouteWaypointOptimizer";
import { cn } from "@/lib/utils";

export interface CarpoolRouteWaypointOptimizerWidgetProps {
  carpoolId?: string;
  driverName?: string;
  venueName?: string;
  initialWaypoints?: CarpoolWaypoint[];
  onRouteOptimized?: (result: CarpoolRouteOptimizationResult) => void;
  className?: string;
}

export const MOCK_WAYPOINTS: CarpoolWaypoint[] = [
  { riderId: "r1", riderName: "Alice Vance", pickupLocation: "North Quad Dorms", lat: 37.7749, lng: -122.4194 },
  { riderId: "r2", riderName: "Bob Chen", pickupLocation: "South Housing Village", lat: 37.7833, lng: -122.4167 },
  { riderId: "r3", riderName: "Elena Rostova", pickupLocation: "West Campus Apartments", lat: 37.7690, lng: -122.4480 },
  { riderId: "r4", riderName: "David Miller", pickupLocation: "East Innovation Hub", lat: 37.7710, lng: -122.4050 },
];

export const CarpoolRouteWaypointOptimizerWidget: React.FC<CarpoolRouteWaypointOptimizerWidgetProps> = ({
  carpoolId = "carpool-robotics-2026",
  driverName = "Alex Rivera",
  venueName = "Regional Tech Conference Center",
  initialWaypoints = MOCK_WAYPOINTS,
  onRouteOptimized,
  className,
}) => {
  const [optimizationResult, setOptimizationResult] = useState<CarpoolRouteOptimizationResult>(() => {
    const req: CarpoolRouteOptimizationRequest = {
      carpoolId,
      driverId: "u-driver-1",
      venueName,
      venueLat: 37.7900,
      venueLng: -122.4000,
      waypoints: initialWaypoints,
    };
    return processCarpoolRouteOptimization(req);
  });

  const [notice, setNotice] = useState<string | null>(null);

  const handleRecalculateRoute = () => {
    const req: CarpoolRouteOptimizationRequest = {
      carpoolId,
      driverId: "u-driver-1",
      venueName,
      venueLat: 37.7900,
      venueLng: -122.4000,
      waypoints: initialWaypoints,
    };
    const result = processCarpoolRouteOptimization(req);
    setOptimizationResult(result);

    if (onRouteOptimized) onRouteOptimized(result);

    setNotice(
      `Route re-optimized! Saved ${result.timeSavedMinutes} minutes (${result.originalDistanceMiles} miles → ${result.optimizedDistanceMiles} miles).`
    );
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-sky-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-sky-950">
            <Navigation className="w-5 h-5 text-sky-700 animate-bounce" />
            <span>Dynamic "Carpool" Route Waypoint Optimizer — {venueName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Solves Traveling Salesperson Problem (TSP) for carpool rider pickups via Google Maps Directions API (`optimizeWaypoints: true`).
          </p>
        </div>

        <span className="px-3 py-1 bg-black text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <Zap className="w-3.5 h-3.5 text-sky-300" />
          <span>TSP Route Optimized</span>
        </span>
      </div>

      {/* Confirmation Notification Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Metrics Summary & Pickup Sequence List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left Column: Route Efficiency Metrics & Navigation Action */}
        <div className="p-5 border-b-2 md:border-b-0 md:border-r-2 border-black space-y-4 bg-white">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Compass className="w-4 h-4 text-sky-600" />
            Route Efficiency Metrics
          </h4>

          {/* Efficiency Metric Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border-2 border-black rounded-lg bg-sky-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Time Saved</span>
              <span className="font-black text-lg text-sky-900 font-mono">
                {optimizationResult.timeSavedMinutes} Mins
              </span>
              <p className="text-[10px] font-sans text-gray-600">Reduced from 45 min driving</p>
            </div>

            <div className="p-3 border-2 border-black rounded-lg bg-emerald-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Distance</span>
              <span className="font-black text-lg text-emerald-900 font-mono">
                {optimizationResult.optimizedDistanceMiles} Mi
              </span>
              <p className="text-[10px] font-sans text-gray-600">Down from {optimizationResult.originalDistanceMiles} mi</p>
            </div>
          </div>

          <a
            href={optimizationResult.googleMapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 border-2 border-black bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4 text-amber-300" />
            <span>Open Google Maps Navigation</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={handleRecalculateRoute}
            className="w-full py-2 px-3 border-2 border-black bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase rounded-md shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
          >
            Re-Calculate Pickup Order
          </button>
        </div>

        {/* Right Column: Mathematically Optimal Pickup Sequence */}
        <div className="p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Users className="w-4 h-4 text-sky-600" />
            Optimized Pickup Stop Sequence
          </h4>

          <div className="space-y-2">
            {optimizationResult.optimizedWaypoints.map((stop, idx) => (
              <div
                key={stop.riderId}
                className="p-3 border-2 border-black rounded-lg bg-white flex items-center gap-3 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <div className="w-6 h-6 rounded-full bg-black text-white font-bold flex items-center justify-center text-xs shrink-0 font-mono">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <span className="font-bold text-gray-900 block">{stop.riderName}</span>
                  <span className="text-[10px] text-gray-500 font-sans flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-sky-600" /> {stop.pickupLocation}
                  </span>
                </div>
              </div>
            ))}

            {/* Destination Venue Stop */}
            <div className="p-3 border-2 border-black rounded-lg bg-slate-900 text-white flex items-center gap-3 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="w-6 h-6 rounded-full bg-sky-500 text-black font-black flex items-center justify-center text-xs shrink-0 font-mono">
                END
              </div>
              <div>
                <span className="font-bold text-sky-400 block uppercase">{venueName}</span>
                <span className="text-[10px] text-gray-300 font-sans">Final Event Destination</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
