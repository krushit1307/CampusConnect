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
import { Sparkles, CheckCircle2, UserCheck, ArrowRight } from "lucide-react";
import { getStaleProfilePromptText } from "@/services/profileFreshnessService";

interface StaleProfileNudgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCurrent: () => Promise<void> | void;
  onUpdateProfile: () => void;
  major?: string | null;
  isConfirming?: boolean;
}

export const StaleProfileNudgeModal: React.FC<StaleProfileNudgeModalProps> = ({
  isOpen,
  onClose,
  onConfirmCurrent,
  onUpdateProfile,
  major,
  isConfirming = false,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px] border-lime-500/40 bg-slate-950 text-slate-100 shadow-2xl p-6 rounded-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-lime-500/10 border border-lime-500/30 rounded-xl text-lime-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-100">
                Keep Your Recommendations Fresh
              </DialogTitle>
              <div className="text-xs text-lime-400 font-medium">Profile Data Freshness</div>
            </div>
          </div>

          <DialogDescription className="text-slate-300 text-sm leading-relaxed pt-1">
            {getStaleProfilePromptText(major)}
          </DialogDescription>
        </DialogHeader>

        <div className="my-3 p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <UserCheck className="h-4 w-4 text-lime-400 shrink-0" />
            <span>Why are we asking?</span>
          </div>
          <p className="text-slate-400">
            We use your major, skills, and academic stage to tailor club matches, event invites, and
            research lab opportunities.
          </p>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onUpdateProfile}
            disabled={isConfirming}
            className="w-full sm:flex-1 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white flex items-center justify-center gap-2"
          >
            <span>No, update profile</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            onClick={onConfirmCurrent}
            disabled={isConfirming}
            className="w-full sm:flex-1 bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isConfirming ? "Confirming..." : "Yes, looks good"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
