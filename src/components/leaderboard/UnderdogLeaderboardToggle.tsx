// =============================================================================
// File: src/components/leaderboard/UnderdogLeaderboardToggle.tsx
// Feature: Dynamic "Club Leaderboard" Underdog Multiplier
// Description: Interactive mode switch component between Raw Volume Points and
//              Per-Capita Underdog Balanced scoring with algorithm popover.
// =============================================================================

import React, { useState } from "react";
import Flame from "lucide-react/dist/esm/icons/flame";
import Zap from "lucide-react/dist/esm/icons/zap";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import type { LeaderboardMode } from "@/types/underdogLeaderboard";

interface UnderdogLeaderboardToggleProps {
  mode: LeaderboardMode;
  onModeChange: (mode: LeaderboardMode) => void;
}

export const UnderdogLeaderboardToggle: React.FC<UnderdogLeaderboardToggleProps> = ({
  mode,
  onModeChange,
}) => {
  const [showInfoPopover, setShowInfoPopover] = useState(false);

  return (
    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 neu-border bg-white p-4 shadow-[3px_3px_0_0_#000] dark:bg-zinc-900 dark:border-zinc-800">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black uppercase text-purple-900 dark:text-purple-300 flex items-center gap-1">
            <Flame className="h-4 w-4 text-amber-500 animate-pulse" /> Club Ranking Engine
          </span>
          <button
            onClick={() => setShowInfoPopover(!showInfoPopover)}
            className="text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
            title="How the Underdog Multiplier works"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
          {mode === "underdog"
            ? "Per-Capita Underdog Mode: Multiplier active! Small clubs with high engagement get a fair boost."
            : mode === "categorical"
            ? "Categorical Weighted Mode: Points scaled by activity impact (STEM 1.4x, Service 1.3x) + Diversity Bonus."
            : "Raw Points Mode: Total aggregated engagement points across all club members."}
        </p>
      </div>

      {/* Mode Switch Buttons */}
      <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
        <button
          onClick={() => onModeChange("raw")}
          className={`px-3 py-1.5 font-bold uppercase transition-all neu-border ${
            mode === "raw"
              ? "bg-black text-white dark:bg-white dark:text-black shadow-none translate-y-0.5"
              : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200"
          }`}
        >
          🏛️ Raw Total
        </button>

        <button
          onClick={() => onModeChange("categorical")}
          className={`px-3 py-1.5 font-bold uppercase transition-all neu-border flex items-center gap-1 ${
            mode === "categorical"
              ? "bg-purple-500 text-white shadow-none translate-y-0.5"
              : "bg-purple-100 text-purple-900 hover:bg-purple-200 dark:bg-purple-950 dark:text-purple-300"
          }`}
        >
          🎯 Categorical Weighted
        </button>

        <button
          onClick={() => onModeChange("underdog")}
          className={`px-3 py-1.5 font-bold uppercase transition-all neu-border flex items-center gap-1 ${
            mode === "underdog"
              ? "bg-amber-400 text-black shadow-none translate-y-0.5"
              : "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          <Zap className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
          ⚡ Underdog Multiplier
        </button>
      </div>

      {/* Algorithm Info Popover */}
      {showInfoPopover && (
        <div className="absolute top-full left-0 mt-2 z-50 w-full sm:w-96 rounded-xl border-2 border-black bg-yellow-50 p-4 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:text-white dark:border-zinc-700 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 border-b border-black/20 dark:border-zinc-700">
            <h4 className="font-mono font-bold text-xs uppercase flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Underdog Multiplier Formula
            </h4>
            <button
              onClick={() => setShowInfoPopover(false)}
              className="text-xs font-bold font-mono hover:text-red-600"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 font-mono text-[11px] space-y-2 text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <p>
              <strong>Why?</strong> Mega-clubs (500+ members) dominate raw point tallies. The Underdog Multiplier levels the playing field for small, active clubs!
            </p>
            <p className="bg-yellow-200/70 dark:bg-zinc-800 p-2 rounded border border-black/10 font-mono text-[10px] font-bold">
              Adjusted Score = (30% × Raw Points) + (70% × PerCapitaPoints × UnderdogMultiplier)
            </p>
            <p>
              • <strong>Per-Capita Points:</strong> Raw Points ÷ Member Count.
              <br />• <strong>Underdog Multiplier:</strong> Up to <strong>2.2× boost</strong> scaling inversely with club size + active participation density.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
