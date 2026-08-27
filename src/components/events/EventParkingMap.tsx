import React, { useState } from "react";
import { Car, Navigation, MapPin, ExternalLink, ShieldCheck, Footprints, RefreshCw } from "lucide-react";
import {
  DesignatedParkingLot,
  getParkingOccupancyStatus,
  getGoogleMapsParkingNavUrl,
  getAppleMapsParkingNavUrl,
} from "@/lib/campusParking";
import { cn } from "@/lib/utils";

export interface EventParkingMapProps {
  eventName?: string;
  venueName?: string;
  parkingLots?: DesignatedParkingLot[];
  className?: string;
}

export const DEFAULT_MOCK_PARKING_LOTS: DesignatedParkingLot[] = [
  {
    id: "lot-a",
    name: "Lot A - West Campus Garage",
    capacity: 250,
    currentOccupancy: 120, // 48% -> Green (Available)
    isFree: true,
    lat: 37.7749,
    lng: -122.4194,
    entranceLat: 37.7751,
    entranceLng: -122.4192,
    walkingMinutesToVenue: 4,
  },
  {
    id: "lot-b",
    name: "Lot B - Student Center Lot",
    capacity: 150,
    currentOccupancy: 125, // 83% -> Yellow (Filling Up)
    isFree: true,
    lat: 37.776,
    lng: -122.418,
    entranceLat: 37.7762,
    entranceLng: -122.4178,
    walkingMinutesToVenue: 2,
  },
  {
    id: "lot-c",
    name: "Lot C - East Parking Structure",
    capacity: 300,
    currentOccupancy: 285, // 95% -> Red (Full)
    isFree: false,
    hourlyRate: 3.0,
    lat: 37.773,
    lng: -122.421,
    entranceLat: 37.7732,
    entranceLng: -122.4208,
    walkingMinutesToVenue: 7,
  },
];

export const EventParkingMap: React.FC<EventParkingMapProps> = ({
  eventName = "Campus Event",
  venueName = "Main Auditorium",
  parkingLots = DEFAULT_MOCK_PARKING_LOTS,
  className,
}) => {
  const [selectedLotId, setSelectedLotId] = useState<string>(parkingLots[0]?.id || "lot-a");
  const selectedLot = parkingLots.find((l) => l.id === selectedLotId) || parkingLots[0];

  const occupancy = selectedLot ? getParkingOccupancyStatus(selectedLot.currentOccupancy, selectedLot.capacity) : null;

  return (
    <div className={cn("border-2 border-black rounded-xl bg-white font-mono overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]", className)}>
      {/* Header Bar */}
      <div className="p-4 bg-emerald-50 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-emerald-950">
            <Car className="w-5 h-5 text-emerald-600" />
            <span>Event Campus Parking Map</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-0.5">
            Organized parking logistics for {eventName} at {venueName}. Avoid congestion with real-time lot occupancy.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-black px-2.5 py-1 rounded text-xs font-bold text-gray-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Official Event Parking</span>
        </div>
      </div>

      {/* Map Viewport & Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Interactive Map Visual Viewport (#3537) */}
        <div className="lg:col-span-2 relative min-h-[360px] bg-slate-900 flex items-center justify-center p-6 text-white border-b-2 lg:border-b-0 lg:border-r-2 border-black select-none">
          {/* Map Overlay Canvas Simulation */}
          <div data-testid="parking-map-canvas" className="w-full h-full border-2 border-dashed border-emerald-500/40 rounded-xl bg-slate-800/80 p-4 relative flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-bold border-b border-slate-700 pb-2">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-500 animate-bounce" />
                Venue Target: {venueName}
              </span>
              <span className="text-gray-400 text-[11px]">Real-Time GPS Polygons Active</span>
            </div>

            {/* Parking Lots Overlay Markers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-auto">
              {parkingLots.map((lot) => {
                const status = getParkingOccupancyStatus(lot.currentOccupancy, lot.capacity);
                const isSelected = lot.id === selectedLotId;

                return (
                  <div
                    key={lot.id}
                    onClick={() => setSelectedLotId(lot.id)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all cursor-pointer space-y-1.5",
                      isSelected ? "bg-slate-700 border-amber-400 ring-2 ring-amber-400 scale-105 shadow-lg" : "bg-slate-800/90 border-slate-600 hover:border-slate-400"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs truncate max-w-[120px]">{lot.name.split(" - ")[0]}</span>
                      <span className={cn("w-3 h-3 rounded-full border border-black shrink-0", status.bgClass)} title={status.status} />
                    </div>
                    <div className="text-[11px] text-gray-300 flex items-center justify-between">
                      <span>{status.occupancyPercent}% Full</span>
                      <span>{lot.isFree ? "Free" : `$${lot.hourlyRate}/hr`}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Polygon Map Color Legend */}
            <div className="flex items-center justify-between text-[11px] text-gray-300 pt-2 border-t border-slate-700">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> &lt;70% Available
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 70-89% Filling Up
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &ge;90% Full
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Lot Detail & 1-Click External Navigation Bar (#3537) */}
        <div className="lg:col-span-1 p-5 bg-white space-y-4 flex flex-col justify-between">
          {selectedLot && occupancy ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-base text-black">{selectedLot.name}</h4>
                  <span className={cn("px-2.5 py-0.5 text-xs font-bold uppercase border border-black rounded-full text-white", occupancy.bgClass)}>
                    {occupancy.status} ({occupancy.occupancyPercent}%)
                  </span>
                </div>
                <p className="text-xs font-sans text-gray-600 mt-1">
                  {selectedLot.isFree ? "Free Event Parking Lot" : `Paid Parking Structure ($${selectedLot.hourlyRate?.toFixed(2)}/hr)`}
                </p>
              </div>

              {/* Occupancy Progress Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>Capacity: {selectedLot.currentOccupancy} / {selectedLot.capacity} vehicles</span>
                  <span>{occupancy.occupancyPercent}%</span>
                </div>
                <div className="h-3 w-full bg-gray-100 border-2 border-black rounded-full overflow-hidden p-0.5">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", occupancy.bgClass)}
                    style={{ width: `${occupancy.occupancyPercent}%` }}
                  />
                </div>
              </div>

              {/* Walking Distance to Venue */}
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 p-2.5 rounded-lg text-xs font-sans text-amber-950">
                <Footprints className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Approximately <span className="font-bold">{selectedLot.walkingMinutesToVenue || 5} min walk</span> ({((selectedLot.walkingMinutesToVenue || 5) * 80).toLocaleString()}m) to {venueName}.
                </span>
              </div>

              {/* 1-Click Navigation Buttons (#3537) */}
              <div className="space-y-2 pt-2 border-t border-black/10">
                <span className="text-xs font-bold uppercase tracking-wider block text-gray-800">
                  1-Click Direct GPS Navigation:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={getGoogleMapsParkingNavUrl(selectedLot.entranceLat || selectedLot.lat, selectedLot.entranceLng || selectedLot.lng, selectedLot.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 border-2 border-black bg-emerald-600 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    Google Maps
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={getAppleMapsParkingNavUrl(selectedLot.entranceLat || selectedLot.lat, selectedLot.entranceLng || selectedLot.lng, selectedLot.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 border-2 border-black bg-black text-white font-bold text-xs uppercase rounded-md hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    Apple Maps
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-gray-500 py-8">Select a parking lot from the map</div>
          )}
        </div>
      </div>
    </div>
  );
};
