import React from "react";
import { CommuteConflictAnalysis, CommuteMode } from "@/services/dynamicCommuteRsvpWarningService";
import {
  MapPin,
  Navigation,
  ArrowRight,
  Footprints,
  Bike,
  Bus,
  AlertTriangle,
  Clock,
} from "lucide-react";

interface CommuteRouteVisualizerProps {
  conflict: CommuteConflictAnalysis;
  selectedMode: CommuteMode;
  onModeSelect: (mode: CommuteMode) => void;
}

export const CommuteRouteVisualizer: React.FC<CommuteRouteVisualizerProps> = ({
  conflict,
  selectedMode,
  onModeSelect,
}) => {
  const { targetEvent, adjacentEvent, gapMinutes, distanceKm, alternativeOptions } = conflict;

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-4">
      {/* Route Journey Visual Map */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Origin */}
        <div className="flex-1 space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5 text-rose-500" />
            Previous Venue
          </div>
          <div className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
            {adjacentEvent.location}
          </div>
          <div className="text-[11px] text-slate-400">
            Ends:{" "}
            {new Date(adjacentEvent.endDate).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>

        {/* Journey Connector */}
        <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-center min-w-[140px]">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-600 dark:text-amber-400">
            <Navigation className="w-3.5 h-3.5 animate-bounce" />
            {distanceKm} km transit
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
            <Clock className="w-3 h-3" />
            {gapMinutes} min gap only
          </div>
        </div>

        {/* Destination */}
        <div className="flex-1 space-y-1 text-center sm:text-right">
          <div className="flex items-center justify-center sm:justify-end gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
            Target Venue
          </div>
          <div className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
            {targetEvent.location}
          </div>
          <div className="text-[11px] text-slate-400">
            Starts:{" "}
            {new Date(targetEvent.startDate).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      {/* Multi-modal alternatives selector */}
      <div>
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Compare Transit Modes & Timings:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {alternativeOptions.map((opt) => {
            const isSelected = selectedMode === opt.mode;
            const Icon = opt.mode === "WALKING" ? Footprints : opt.mode === "BICYCLE" ? Bike : Bus;

            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => onModeSelect(opt.mode)}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-300"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="flex items-center gap-1.5 font-bold text-xs capitalize">
                    <Icon className="w-4 h-4" />
                    {opt.mode.toLowerCase().replace("_", " ")}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      opt.isFeasible
                        ? isSelected
                          ? "bg-white/20 text-white"
                          : "bg-emerald-100 text-emerald-800"
                        : isSelected
                          ? "bg-white/20 text-white"
                          : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {opt.isFeasible ? "On Time" : "Late"}
                  </span>
                </div>
                <div className="text-xs font-extrabold">{opt.durationMinutes} mins</div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    isSelected ? "text-orange-100" : "text-slate-400"
                  }`}
                >
                  {opt.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
