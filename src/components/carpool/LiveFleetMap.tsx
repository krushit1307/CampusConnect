import React, { useState, useEffect } from 'react';
import { CarpoolRide } from '@/types/carpool';
import { Navigation, ShieldAlert, Car, MapPin, Radio, AlertTriangle } from 'lucide-react';

interface LiveFleetMapProps {
  ride: CarpoolRide;
  onTriggerSos?: (rideId: string) => void;
}

export function LiveFleetMap({ ride, onTriggerSos }: LiveFleetMapProps) {
  const [vehicleProgress, setVehicleProgress] = useState(0.35); // 0.0 to 1.0 along route

  // Simulate GPS coordinate stream
  useEffect(() => {
    if (ride.status === 'en_route') {
      const interval = setInterval(() => {
        setVehicleProgress((prev) => (prev >= 0.95 ? 0.1 : prev + 0.05));
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [ride.status]);

  const routeStops = ride.routeStops;

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
      {/* Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-black text-xl text-black">
              Live Ride Telemetry & GPS Tracking
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-green-100 text-green-800 border border-green-300">
              <Radio size={12} className="text-green-600 animate-pulse" /> Live Telemetry
            </span>
          </div>
          <p className="font-mono text-xs text-gray-600">
            {ride.vehicleModel} ({ride.licensePlate}) • {ride.driverName} (★ {ride.driverRating.toFixed(1)})
          </p>
        </div>

        {/* SOS Emergency Trigger */}
        <button
          onClick={() => onTriggerSos?.(ride.id)}
          className={`px-3.5 py-1.5 rounded font-mono text-xs font-black uppercase flex items-center gap-1.5 border-2 border-black transition-all ${
            ride.safetySosTriggered
              ? 'bg-red-600 text-white animate-bounce'
              : 'bg-red-100 text-red-800 hover:bg-red-200'
          }`}
        >
          <AlertTriangle size={14} />
          {ride.safetySosTriggered ? 'SOS DISPATCHED' : 'Emergency SOS'}
        </button>
      </div>

      {/* Interactive Map Canvas Simulation */}
      <div className="relative w-full aspect-16/9 bg-slate-900 border-2 border-black rounded-lg overflow-hidden p-6 text-white flex flex-col justify-between">
        {/* Grid Background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)`,
            backgroundSize: '8% 8%',
          }}
        />

        {/* Safety Geofence Corridor Warning */}
        <div className="absolute top-3 left-3 bg-black/80 border border-emerald-500/50 px-3 py-1 rounded font-mono text-xs text-emerald-400 flex items-center gap-1.5 backdrop-blur-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Geofence Corridor: Active (0.0 mi deviation)</span>
        </div>

        {/* SVG Route Line */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <polyline
            points="60,200 180,120 320,160 520,90 680,140"
            fill="none"
            stroke="#4ade80"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="8 6"
          />
        </svg>

        {/* Route Stops Nodes */}
        <div className="relative w-full h-full">
          {routeStops.map((stop, idx) => {
            const positions = [
              { left: '8%', top: '65%' },
              { left: '26%', top: '38%' },
              { left: '46%', top: '50%' },
              { left: '74%', top: '28%' },
              { left: '92%', top: '44%' },
            ];
            const pos = positions[idx] || positions[0];

            return (
              <div
                key={stop.name}
                style={{ left: pos.left, top: pos.top }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10"
              >
                <div className="w-6 h-6 rounded-full bg-lime text-black border-2 border-black flex items-center justify-center font-mono font-black text-[10px] shadow-xs">
                  {idx + 1}
                </div>
                <span className="font-mono text-[10px] font-bold bg-black/80 px-2 py-0.5 rounded border border-gray-700 whitespace-nowrap text-white">
                  {stop.name}
                </span>
              </div>
            );
          })}

          {/* Dynamic Car Marker */}
          <div
            style={{
              left: `${vehicleProgress * 80 + 10}%`,
              top: `${Math.sin(vehicleProgress * Math.PI * 2) * 20 + 45}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-1000 flex flex-col items-center"
          >
            <div className="p-2 bg-amber-400 text-black border-2 border-black rounded-full shadow-lg animate-pulse">
              <Car size={20} />
            </div>
            <span className="font-mono text-[9px] font-black bg-amber-400 text-black px-1.5 rounded border border-black mt-0.5">
              34 MPH
            </span>
          </div>
        </div>

        {/* Map Footer Bar */}
        <div className="relative z-10 flex justify-between items-center text-xs font-mono bg-black/80 px-4 py-2 rounded border border-gray-800 backdrop-blur-xs">
          <span>Est. Arrival: <strong className="text-lime">{ride.estimatedArrival}</strong></span>
          <span>Seats Available: <strong className="text-white">{ride.availableSeats} / {ride.totalSeats}</strong></span>
        </div>
      </div>
    </div>
  );
}
