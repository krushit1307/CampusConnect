import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, MapPin, Navigation } from "lucide-react";
import type { CommuteConflict } from "@/services/commuteConflictService";

interface CommuteRsvpWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  conflict: CommuteConflict | null;
  targetEventTitle: string;
  isSubmitting?: boolean;
}

export const CommuteRsvpWarningModal: React.FC<CommuteRsvpWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  conflict,
  targetEventTitle,
  isSubmitting = false,
}) => {
  if (!conflict) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] border-amber-500/30 bg-slate-900 text-slate-100 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center space-x-2 text-amber-400 mb-1">
            <div className="p-2 bg-amber-500/10 rounded-full border border-amber-500/20">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-100">
              Commute Time Warning
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-300 text-sm mt-2">
            You may not have enough time to travel between adjacent events on your schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-3 bg-slate-800/80 p-4 rounded-xl border border-slate-700/60">
          <div className="flex items-start space-x-3">
            <Navigation className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-slate-200">
                {conflict.conflictType === "before" ? "Previous Event:" : "Next Event:"}
              </span>{" "}
              <span className="text-slate-300">{conflict.adjacentEvent.title}</span>
              {conflict.adjacentEvent.location && (
                <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {conflict.adjacentEvent.location}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50">
            <div className="flex items-center space-x-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
              <Clock className="h-4 w-4 text-rose-400 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-medium">Gap</div>
                <div className="text-sm font-bold text-rose-300">
                  {conflict.temporalGapMinutes} min
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
              <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-medium">Est. Walk</div>
                <div className="text-sm font-bold text-cyan-300">
                  ~{conflict.estimatedTravelMinutes} min ({conflict.distanceMiles} mi)
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-lg text-xs text-amber-200/90 leading-relaxed">
            {conflict.warningMessage}
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            Cancel RSVP
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-white font-semibold"
          >
            {isSubmitting ? "Confirming..." : "RSVP Anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
