import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  MapPin,
  Clock,
  PhoneCall,
  Zap,
  CheckCircle2,
  Navigation,
  Sparkles,
  Radio,
  Sun,
} from "lucide-react";
import {
  SafetyEscortTrackerState,
  calculateEscortEta,
  updateOfficerGpsCoordinates,
} from "@/lib/campusSafetyEscortEtaTracker";
import { cn } from "@/lib/utils";

export interface CampusSafetyEscortEtaTrackerWidgetProps {
  requestId?: string;
  studentId?: string;
  officerName?: string;
  officerBadgeNumber?: string;
  initialState?: SafetyEscortTrackerState;
  onStatusUpdated?: (state: SafetyEscortTrackerState) => void;
  className?: string;
}

export const CampusSafetyEscortEtaTrackerWidget: React.FC<CampusSafetyEscortEtaTrackerWidgetProps> = ({
  requestId = "req-escort-101",
  studentId = "u-student-9901",
  officerName = "Officer Smith",
  officerBadgeNumber = "PD-402",
  initialState,
  onStatusUpdated,
  className,
}) => {
  const [trackerState, setTrackerState] = useState<SafetyEscortTrackerState>(() => {
    return (
      initialState || {
        requestId,
        studentId,
        officerName,
        officerBadgeNumber,
        studentLocation: { lat: 37.7749, lng: -122.4194 },
        officerLocation: { lat: 37.7800, lng: -122.4150 },
        etaMinutes: 3,
        distanceMiles: 0.4,
        status: "en_route",
        lastUpdated: new Date().toISOString(),
      }
    );
  });

  const [flashingSignal, setFlashingSignal] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Simulate WebSocket GPS streaming updates every 3 seconds
  useEffect(() => {
    if (trackerState.status === "arrived" || trackerState.status === "completed") return;

    const timer = setTimeout(() => {
      // Advance officer closer to student
      const targetLat = trackerState.studentLocation.lat;
      const targetLng = trackerState.studentLocation.lng;
      const currentLat = trackerState.officerLocation.lat;
      const currentLng = trackerState.officerLocation.lng;

      const newLat = currentLat + (targetLat - currentLat) * 0.4;
      const newLng = currentLng + (targetLng - currentLng) * 0.4;

      const updated = updateOfficerGpsCoordinates(trackerState, newLat, newLng);
      setTrackerState(updated);

      if (onStatusUpdated) onStatusUpdated(updated);

      if (updated.status === "arrived") {
        setNotice(`🛡️ ${officerName} HAS ARRIVED at your location! Look for Badge #${officerBadgeNumber}.`);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [trackerState]);

  const handleToggleFlashSignal = () => {
    setFlashingSignal(!flashingSignal);
  };

  const isArrived = trackerState.status === "arrived";

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        flashingSignal ? "bg-amber-300 animate-pulse" : "bg-white",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-rose-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-rose-950">
            <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
            <span>Real-Time "Campus Safety" Escort ETA Tracker</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Uber-style live radar map & Google Maps Distance Matrix ETA calculator for incoming campus security escorts.
          </p>
        </div>

        <span
          className={cn(
            "px-3 py-1 text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
            isArrived ? "bg-emerald-600 animate-bounce" : "bg-rose-600 animate-pulse"
          )}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>{isArrived ? "OFFICER ARRIVED" : "OFFICER EN ROUTE"}</span>
        </span>
      </div>

      {/* Arrival Notification Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Radar Screen & Dispatch Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left Column: Uber-Style Live Radar Screen Canvas */}
        <div className="p-5 border-b-2 md:border-b-0 md:border-r-2 border-black space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-rose-600" />
              Live Radar Stream Canvas (Officer GPS)
            </h4>
            <span className="text-[10px] font-mono text-emerald-600 font-bold">
              WEBSOCKET STREAMING OK
            </span>
          </div>

          {/* Radar Screen Visual Canvas */}
          <div className="relative aspect-video bg-slate-950 border-2 border-black rounded-lg overflow-hidden flex flex-col justify-between p-4 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {/* Target & Officer Blips */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border border-emerald-500/30 animate-ping absolute" />
              <div className="w-48 h-48 rounded-full border border-emerald-500/20 absolute" />

              {/* Officer Blip */}
              <div className="flex flex-col items-center gap-1 z-10">
                <div className="w-5 h-5 rounded-full bg-rose-500 border-2 border-white animate-bounce flex items-center justify-center">
                  <ShieldAlert className="w-3 h-3 text-white" />
                </div>
                <span className="text-[9px] font-mono bg-black/80 px-1.5 py-0.5 rounded text-rose-300 font-bold border border-rose-600">
                  {officerName} ({trackerState.distanceMiles} mi)
                </span>
              </div>
            </div>

            {/* Live ETA Card Overlay */}
            <div className="z-20 bg-slate-900/90 p-3 rounded-md border border-slate-700 space-y-1 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center text-[10px] text-gray-400 border-b border-slate-700 pb-1">
                <span>RESPONDEE: {officerName} (#{officerBadgeNumber})</span>
                <span className="text-emerald-400 font-bold">LIVE GPS</span>
              </div>
              <p className="text-sm font-black text-rose-400 uppercase">
                {isArrived
                  ? "OFFICER IS HERE AT PICKUP LOCATION"
                  : `${officerName} is ${trackerState.etaMinutes} minutes away`}
              </p>
              <p className="text-[10px] text-gray-300 font-sans">
                Distance: {trackerState.distanceMiles} miles • Updated live via WebSocket
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Dispatch Details & Emergency Tools */}
        <div className="p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Zap className="w-4 h-4 text-rose-600" />
            Safety Tools & Dispatch Contacts
          </h4>

          {/* Officer Details Card */}
          <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-2 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Dispatched Officer Info</span>
            <div className="space-y-1 text-gray-900">
              <p>Name: <span className="font-bold">{officerName}</span></p>
              <p>Badge Number: <span className="font-bold text-rose-700">#{officerBadgeNumber}</span></p>
              <p>Vehicle: <span className="font-bold">Campus Security Patrol #12</span></p>
            </div>
          </div>

          {/* Emergency Action Buttons */}
          <div className="space-y-2 pt-2">
            <a
              href="tel:911"
              className="w-full py-3 px-4 border-2 border-black bg-rose-600 text-white font-bold text-xs uppercase rounded-md hover:bg-rose-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
            >
              <PhoneCall className="w-4 h-4 text-amber-300" />
              Call Campus Dispatch (1-800-CAMPUS-PD)
            </a>

            <button
              type="button"
              onClick={handleToggleFlashSignal}
              className="w-full py-2.5 px-4 border-2 border-black bg-amber-400 text-black font-bold text-xs uppercase rounded-md hover:bg-amber-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
            >
              <Sun className="w-4 h-4" />
              {flashingSignal ? "Stop Strobe Screen Signal" : "Flash Phone Screen Strobe Signal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
