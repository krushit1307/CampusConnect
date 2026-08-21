import React from "react";
import { TrendingUp, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  calculateWaitlistProbability,
  WaitlistProbabilityOptions,
} from "@/lib/waitlistPredictor";
import { cn } from "@/lib/utils";

export interface WaitlistProbabilityBadgeProps extends WaitlistProbabilityOptions {
  className?: string;
}

export const WaitlistProbabilityBadge: React.FC<WaitlistProbabilityBadgeProps> = ({
  position,
  capacity,
  isFree = true,
  pastEventsCount = 0,
  historicalDropoutRate = null,
  className,
}) => {
  const result = calculateWaitlistProbability({
    position,
    capacity,
    isFree,
    pastEventsCount,
    historicalDropoutRate,
  });

  const getTierStyles = (tier: typeof result.tier) => {
    switch (tier) {
      case "High":
        return {
          bg: "bg-emerald-50 border-emerald-600 text-emerald-950",
          badgeBg: "bg-emerald-600 text-white",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        };
      case "Medium":
        return {
          bg: "bg-amber-50 border-amber-600 text-amber-950",
          badgeBg: "bg-amber-600 text-white",
          icon: <TrendingUp className="w-4 h-4 text-amber-600" />,
        };
      case "Low":
        return {
          bg: "bg-orange-50 border-orange-600 text-orange-950",
          badgeBg: "bg-orange-600 text-white",
          icon: <AlertTriangle className="w-4 h-4 text-orange-600" />,
        };
      case "Unlikely":
      default:
        return {
          bg: "bg-rose-50 border-rose-600 text-rose-950",
          badgeBg: "bg-rose-600 text-white",
          icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,
        };
    }
  };

  const style = getTierStyles(result.tier);

  return (
    <div
      data-testid="waitlist-probability-card"
      className={cn(
        "border-2 border-black p-4 rounded-xl font-mono space-y-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]",
        style.bg,
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {style.icon}
          <span className="font-bold text-sm">
            Waitlist Position <span className="underline">#{result.position}</span>
          </span>
        </div>
        <span
          className={cn(
            "px-2.5 py-0.5 text-xs font-bold uppercase border border-black rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
            style.badgeBg
          )}
        >
          {result.tier} ({result.probabilityPercentage}%)
        </span>
      </div>

      <p className="text-xs font-sans leading-relaxed text-gray-800">
        Based on a <span className="font-bold">{result.historicalDropoutRate}%</span> historical dropout rate for{" "}
        {result.isFree ? "free" : "paid"} events, approximately{" "}
        <span className="font-bold">{result.estimatedDropouts} spots</span> are expected to open before start time.
        {result.isFallback && (
          <span className="block text-[11px] italic text-gray-600 mt-0.5">
            (Estimated using global campus averages for new clubs)
          </span>
        )}
      </p>

      {/* Legal & Expectations Disclaimer (#2980) */}
      <div className="flex items-start gap-1.5 pt-2 border-t border-black/20 text-[11px] text-gray-700">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-600" />
        <span className="font-sans leading-tight">{result.disclaimer}</span>
      </div>
    </div>
  );
};
