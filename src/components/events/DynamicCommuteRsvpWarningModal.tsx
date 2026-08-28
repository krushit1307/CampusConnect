import React, { useState } from "react";
import {
  CommuteConflictAnalysis,
  CommuteMode,
  DynamicCommuteRsvpWarningService,
} from "@/services/dynamicCommuteRsvpWarningService";
import { CommuteRouteVisualizer } from "./CommuteRouteVisualizer";
import { AlertTriangle, Clock, MapPin, X, ArrowRight, ShieldAlert, Check } from "lucide-react";

interface DynamicCommuteRsvpWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: CommuteConflictAnalysis | null;
  userId: string;
  onConfirmOverrideRsvp: (chosenMode: CommuteMode) => void;
}

export const DynamicCommuteRsvpWarningModal: React.FC<DynamicCommuteRsvpWarningModalProps> = ({
  isOpen,
  onClose,
  conflict,
  userId,
  onConfirmOverrideRsvp,
}) => {
  const [selectedMode, setSelectedMode] = useState<CommuteMode>("WALKING");

  if (!isOpen || !conflict) return null;

  const currentOption = conflict.alternativeOptions.find((o) => o.mode === selectedMode);
  const isSelectedModeFeasible = currentOption?.isFeasible ?? false;

  const handleProceed = () => {
    const decision = isSelectedModeFeasible ? "SWITCHED_MODE" : "OVERRIDDEN";
    DynamicCommuteRsvpWarningService.logWarningDecision(
      userId,
      conflict.targetEvent.id,
      conflict.adjacentEvent.id,
      decision,
      selectedMode,
    );
    onConfirmOverrideRsvp(selectedMode);
    onClose();
  };

  const handleCancel = () => {
    DynamicCommuteRsvpWarningService.logWarningDecision(
      userId,
      conflict.targetEvent.id,
      conflict.adjacentEvent.id,
      "CANCELLED",
      selectedMode,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 shadow-2xl p-6 sm:p-7 space-y-5">
        {/* Close Button */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header with Warning Badge */}
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 shadow-md">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Spatial-Temporal Commute Warning
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Potential Schedule & Commute Conflict
            </h3>
          </div>
        </div>

        {/* Warning Message Box */}
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm text-rose-900 dark:text-rose-200 leading-relaxed font-medium">
          {conflict.warningMessage}
        </div>

        {/* Interactive Route and Multi-modal Visualizer */}
        <CommuteRouteVisualizer
          conflict={conflict}
          selectedMode={selectedMode}
          onModeSelect={setSelectedMode}
        />

        {/* Modal Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleCancel}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
          >
            Cancel RSVP
          </button>

          <button
            type="button"
            onClick={handleProceed}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
              isSelectedModeFeasible
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
            }`}
          >
            {isSelectedModeFeasible ? (
              <>
                <Check className="w-4 h-4" />
                RSVP & Switch to {selectedMode.replace("_", " ")}
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />I Understand, RSVP Anyway
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
