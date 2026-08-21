// =============================================================================
// Component: CampusSafetyEscortModule
// Issue: #3295 - Interactive Campus Safety Escort Integration
// Description: Prominent late-night event safety escort card rendering on post-event
// UI (21:00 to 05:00). Triggers Campus Security Dispatch or Virtual Buddy alerts.
// =============================================================================

import React, { useState, useEffect } from "react";
import {
  isLateNightEvent,
  getCurrentGPSLocation,
  requestSafetyEscort,
  SafetyEscortRPCResult,
} from "../../services/safetyEscortService";

interface CampusSafetyEscortModuleProps {
  eventTitle: string;
  eventVenue: string;
  eventEndTime?: string | Date;
  eventId?: string;
}

export const CampusSafetyEscortModule: React.FC<CampusSafetyEscortModuleProps> = ({
  eventTitle,
  eventVenue,
  eventEndTime,
  eventId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [requestType, setRequestType] = useState<"campus_security" | "buddy_system">(
    "campus_security",
  );
  const [currentLocation, setCurrentLocation] = useState(eventVenue || "Event Venue");
  const [destinationDorm, setDestinationDorm] = useState("");
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SafetyEscortRPCResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-evaluate if late night event
  const isLateNight = isLateNightEvent(eventEndTime);

  useEffect(() => {
    if (isOpen) {
      getCurrentGPSLocation().then((coords) => {
        if (coords) setGpsLocation(coords);
      });
    }
  }, [isOpen]);

  if (!isLateNight) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationDorm.trim()) {
      setErrorMessage("Please enter your destination dorm or location.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setResult(null);

    const res = await requestSafetyEscort({
      eventId,
      requestType,
      currentLocation,
      destinationDorm,
      latitude: gpsLocation?.latitude,
      longitude: gpsLocation?.longitude,
    });

    setLoading(false);

    if (res.success) {
      setResult(res);
    } else {
      setErrorMessage(res.error || "Failed to dispatch safety request.");
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
      <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header Info */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-500/30">
                Late-Night Event Safety
              </span>
              <span className="text-slate-400 text-xs font-mono">Walk Home Protection</span>
            </div>
            <h3 className="text-xl font-black text-white mt-1">Walking Home Late Tonight?</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Events ending after 9:00 PM offer instant Campus Security escorts and peer virtual
              buddy alerts to ensure you arrive safely at your dorm.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 text-xs shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
          </svg>
          Request Safety Escort
        </button>
      </div>

      {/* Emergency Callout Disclaimer */}
      <div className="mt-4 pt-3 border-t border-indigo-500/20 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>📍 Origin: {eventVenue}</span>
        <span className="text-rose-400 font-bold flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          In a real emergency, call 911 immediately.
        </span>
      </div>

      {/* Request Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-white">
            <button
              onClick={() => {
                setIsOpen(false);
                setResult(null);
              }}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              &times;
            </button>

            {!result ? (
              <>
                <h3 className="text-2xl font-black text-white mb-1">Campus Safety Escort</h3>
                <p className="text-xs text-slate-400 mb-6">
                  Select your safety dispatch type and target dorm destination. GPS location will be
                  attached automatically.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Type Selector */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setRequestType("campus_security")}
                      className={`py-3 rounded-xl text-xs font-bold transition ${
                        requestType === "campus_security"
                          ? "bg-indigo-600 text-white shadow-md"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Campus Security Dispatch
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestType("buddy_system")}
                      className={`py-3 rounded-xl text-xs font-bold transition ${
                        requestType === "buddy_system"
                          ? "bg-purple-600 text-white shadow-md"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Virtual Buddy Alert
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Starting Location
                    </label>
                    <input
                      type="text"
                      value={currentLocation}
                      onChange={(e) => setCurrentLocation(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Destination Dorm / Address
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. West Quad Dorm Block B, Room 204"
                      value={destinationDorm}
                      onChange={(e) => setDestinationDorm(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100"
                    />
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>GPS Coordinates:</span>
                    <span>
                      {gpsLocation
                        ? `${gpsLocation.latitude.toFixed(4)}, ${gpsLocation.longitude.toFixed(4)}`
                        : "Detecting location..."}
                    </span>
                  </div>

                  {/* Emergency Notice */}
                  <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 shrink-0 text-rose-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span>In an emergency, call 911 or Campus Police immediately.</span>
                  </div>

                  {errorMessage && (
                    <p className="text-xs text-rose-400 font-medium">{errorMessage}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      {loading
                        ? "Dispatching..."
                        : requestType === "buddy_system"
                          ? "Send Buddy Ping"
                          : "Submit Dispatch Request"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white">Escort Request Confirmed</h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">{result.message}</p>
                <div className="p-3 bg-slate-950 rounded-xl text-xs font-mono text-emerald-400 border border-slate-800">
                  Status: {result.status?.toUpperCase()}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
