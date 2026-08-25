// =============================================================================
// File: src/components/wellness/CrisisSafetyEscalationDrawer.tsx
// Issue: #4296 - Develop a 'Dynamic "Mental Health" Peer Support Matcher'
// Description: Crisis safety escalation modal displaying immediate 988 lifeline
//              hotlines, crisis text lines, and campus emergency counseling.
// =============================================================================

import React from "react";
import {
  ShieldAlert,
  PhoneCall,
  MessageSquare,
  Heart,
  ExternalLink,
  LifeBuoy,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getCrisisHotlineResources } from "@/services/peerSupportMatcherService";

interface CrisisSafetyEscalationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isTriggeredByKeyword?: boolean;
}

export const CrisisSafetyEscalationDrawer: React.FC<CrisisSafetyEscalationDrawerProps> = ({
  isOpen,
  onClose,
  isTriggeredByKeyword = false,
}) => {
  const hotlines = getCrisisHotlineResources();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="neu-border max-w-xl bg-white p-6 dark:bg-zinc-900 border-2 border-rose-600 shadow-[8px_8px_0_0_#e11d48]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded border-2 border-black bg-rose-600 text-white">
              <ShieldAlert className="h-5 w-5 animate-pulse" />
            </div>
            <DialogTitle className="text-xl font-black uppercase text-zinc-900 dark:text-white">
              Immediate Confidential Crisis Support
            </DialogTitle>
          </div>
          <DialogDescription className="font-mono text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            If you or someone you know is struggling or in crisis, help is available right now.
            You are not alone.
          </DialogDescription>
        </DialogHeader>

        {isTriggeredByKeyword && (
          <div className="neu-border bg-rose-50 p-3 font-mono text-xs text-rose-900 dark:bg-rose-950/50 dark:text-rose-200 border-rose-300">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              Safety System Notice:
            </p>
            <p className="mt-0.5 text-[11px]">
              We noticed words related to intense distress. Peer listeners are fellow students,
              not licensed medical clinicians. Please connect with immediate professional support
              below.
            </p>
          </div>
        )}

        {/* Hotlines List */}
        <div className="space-y-3 font-mono text-xs">
          {hotlines.map((res, i) => (
            <div
              key={i}
              className={`neu-border p-3.5 transition-colors ${
                res.isPrimaryImmediate
                  ? "bg-rose-50/80 border-rose-500 dark:bg-rose-950/30"
                  : "bg-zinc-50 dark:bg-zinc-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black uppercase text-zinc-900 dark:text-white">
                  {res.name}
                </span>
                <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                  {res.availability}
                </span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                {res.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`tel:${res.phone.replace(/[^0-9]/g, "")}`}
                  className="neu-border inline-flex items-center gap-1.5 bg-rose-600 px-3 py-1.5 font-bold uppercase text-white hover:bg-rose-700 shadow-[2px_2px_0_0_#000]"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  Call {res.phone}
                </a>

                {res.smsShortcode && (
                  <a
                    href={`sms:${res.smsShortcode}`}
                    className="neu-border inline-flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 font-bold uppercase text-white hover:bg-zinc-800 dark:bg-white dark:text-black shadow-[2px_2px_0_0_#000]"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Text {res.smsShortcode}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="neu-border font-mono text-xs font-bold uppercase"
          >
            Return to Peer Chat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CrisisSafetyEscalationDrawer;
