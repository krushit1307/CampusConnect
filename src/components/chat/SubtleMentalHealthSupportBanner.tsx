import React, { useState } from "react";
import {
  HeartHandshake,
  Lock,
  X,
  ExternalLink,
  Calendar,
  PhoneCall,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  MentalHealthTriggerResult,
  getSupportResourceMeta,
} from "@/lib/peerChatMentalHealthScanner";
import { cn } from "@/lib/utils";

export interface SubtleMentalHealthSupportBannerProps {
  triggerResult: MentalHealthTriggerResult;
  onDismiss?: () => void;
  className?: string;
}

export const SubtleMentalHealthSupportBanner: React.FC<SubtleMentalHealthSupportBannerProps> = ({
  triggerResult,
  onDismiss,
  className,
}) => {
  const [dismissed, setDismissed] = useState<boolean>(false);

  if (dismissed || !triggerResult || !triggerResult.isTriggered) {
    return null;
  }

  const resourceMeta = getSupportResourceMeta(triggerResult.category);

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  return (
    <div
      data-testid="subtle-mental-health-banner"
      className={cn(
        "p-4 border-2 border-black rounded-xl bg-indigo-50 font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3 relative overflow-hidden transition-all",
        className
      )}
    >
      {/* Privacy Guard Indicator Badge (#4503) */}
      <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-[11px] text-indigo-950 uppercase">
          <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>Private Support Prompt • Visible ONLY to You</span>
        </div>

        <button
          type="button"
          aria-label="Dismiss support prompt"
          onClick={handleDismiss}
          className="p-1 border border-black rounded bg-white hover:bg-slate-100 text-gray-700"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Banner Support Message */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-indigo-600 text-white rounded-lg border-2 border-black shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <HeartHandshake className="w-5 h-5" />
        </div>

        <div className="space-y-1 text-xs">
          <h5 className="font-black text-indigo-950 uppercase text-xs">
            {resourceMeta.title}
          </h5>
          <p className="font-sans text-gray-800 leading-relaxed">
            {triggerResult.supportBannerText || resourceMeta.bannerText}
          </p>
          <p className="text-[11px] font-mono text-indigo-900 font-bold pt-0.5">
            {resourceMeta.contactInfo}
          </p>
        </div>
      </div>

      {/* Action Buttons & Privacy Assurance Footer */}
      <div className="pt-2 border-t border-indigo-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1 text-[10px] text-gray-600 font-sans">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>100% local client-side scan • Not sent to admins or group members</span>
        </div>

        <a
          href={triggerResult.counselingResourceUrl || resourceMeta.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md border-2 border-black flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-[11px] uppercase shrink-0"
        >
          <span>Book Free Walk-In Hours</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
