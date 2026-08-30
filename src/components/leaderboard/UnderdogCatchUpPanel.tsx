// =============================================================================
// File: src/components/leaderboard/UnderdogCatchUpPanel.tsx
// Feature: Underdog Catch-Up Engine – Frontend Panel
// Description: Neubrutalist Underdog Catch-Up Panel rendered on the Leaderboard
//   page for users whose club is in the bottom 50% of the leaderboard. Shows:
//     - Current point multiplier badge (x1.25 / x1.5 / x2.0)
//     - Active quest progress bar with check-in count vs target
//     - Reward preview and expiry countdown
//   Hidden from top-10% club members and non-boosted users.
// =============================================================================

import React from "react";
import Zap from "lucide-react/dist/esm/icons/zap";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Target from "lucide-react/dist/esm/icons/target";
import Clock from "lucide-react/dist/esm/icons/clock";
import Star from "lucide-react/dist/esm/icons/star";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ActiveBounty {
  id: string;
  club_id: string;
  club_name?: string;
  target_checkins: number;
  current_checkins: number;
  reward_points: number;
  expires_at: string;
}

export interface UnderdogCatchUpPanelProps {
  /** The user's current leaderboard rank multiplier (1.0 = no boost) */
  multiplier: number;
  /** Active underdog bounty for the user's club, or null if none */
  activeBounty: ActiveBounty | null;
  /** Optional test-id forwarded to the root element */
  "data-testid"?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns Neubrutalist color classes based on multiplier tier */
function getMultiplierStyle(multiplier: number): {
  bg: string;
  border: string;
  text: string;
  label: string;
} {
  if (multiplier >= 2.0) {
    return {
      bg: "bg-red-400",
      border: "border-red-700",
      text: "text-red-950",
      label: "BOTTOM 10% — MAXIMUM BOOST",
    };
  }
  if (multiplier >= 1.5) {
    return {
      bg: "bg-orange-400",
      border: "border-orange-700",
      text: "text-orange-950",
      label: "BOTTOM 30% — HIGH BOOST",
    };
  }
  return {
    bg: "bg-yellow-300",
    border: "border-yellow-600",
    text: "text-yellow-950",
    label: "BOTTOM 50% — ACTIVE BOOST",
  };
}

/** Returns days/hours until expiry */
function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h remaining`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const UnderdogCatchUpPanel: React.FC<UnderdogCatchUpPanelProps> = ({
  multiplier,
  activeBounty,
  "data-testid": testId = "underdog-catchup-panel",
}) => {
  // Guard: don't render if no boost is active
  if (multiplier <= 1.0) return null;

  const style = getMultiplierStyle(multiplier);

  const progressPct = activeBounty
    ? Math.min(100, Math.round((activeBounty.current_checkins / activeBounty.target_checkins) * 100))
    : 0;

  return (
    <div
      data-testid={testId}
      className="neu-border border-2 border-black shadow-[4px_4px_0_0_#000] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
      role="region"
      aria-label="Underdog Catch-Up Panel"
    >
      {/* Header stripe */}
      <div className={`${style.bg} ${style.border} border-b-2 px-5 py-3 flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <Zap className={`h-5 w-5 ${style.text} fill-current animate-pulse`} aria-hidden="true" />
          <span className={`font-mono text-xs font-black uppercase tracking-widest ${style.text}`}>
            Underdog Catch-Up Engine
          </span>
        </div>
        {/* Multiplier badge */}
        <div
          className={`
            font-mono font-black text-sm px-3 py-1 border-2 border-black shadow-[2px_2px_0_0_#000]
            bg-black text-white flex items-center gap-1.5
          `}
          data-testid="multiplier-badge"
          aria-label={`Point multiplier: ${multiplier}x`}
        >
          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          {multiplier}× Points
        </div>
      </div>

      {/* Body */}
      <div className="bg-white px-5 py-4 space-y-4">
        {/* Tier label + explanation */}
        <div className="flex items-start gap-3">
          <div className={`
            shrink-0 mt-0.5 px-2 py-0.5 font-mono text-[10px] font-black uppercase
            border border-black ${style.bg} ${style.text}
          `}>
            {style.label}
          </div>
          <p className="font-mono text-xs text-gray-700 leading-relaxed">
            Your club is in the <strong>bottom half</strong> of the leaderboard. Every point you earn
            is being automatically multiplied by <strong>{multiplier}×</strong> to help you catch up!
          </p>
        </div>

        {/* Active Bounty Quest */}
        {activeBounty ? (
          <div
            className="neu-border border border-black bg-amber-50 p-4 space-y-3"
            data-testid="active-bounty-section"
            aria-label={`Active bounty for ${activeBounty.club_name ?? "your club"}`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
                <span className="font-mono text-xs font-black uppercase text-amber-900">
                  Active Quest{activeBounty.club_name ? ` — ${activeBounty.club_name}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-gray-500">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span data-testid="bounty-expiry">{formatExpiry(activeBounty.expires_at)}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[11px] font-bold text-amber-900">
                <span data-testid="progress-label">
                  {activeBounty.current_checkins} / {activeBounty.target_checkins} guest check-ins
                </span>
                <span data-testid="progress-pct">{progressPct}%</span>
              </div>
              <div
                className="w-full h-4 bg-amber-200 border border-black"
                role="progressbar"
                aria-valuenow={activeBounty.current_checkins}
                aria-valuemin={0}
                aria-valuemax={activeBounty.target_checkins}
                aria-label="Bounty progress"
              >
                <div
                  className="h-full bg-amber-500 transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                  data-testid="progress-bar-fill"
                />
              </div>
            </div>

            {/* Reward preview */}
            <div className="flex items-center gap-2 font-mono text-[11px] text-amber-800">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
              <span data-testid="reward-preview">
                Claim reward: <strong>+{activeBounty.reward_points} pts</strong> for every club member!
              </span>
            </div>
          </div>
        ) : (
          <div
            className="neu-border border border-dashed border-gray-400 bg-gray-50 p-4 text-center"
            data-testid="no-bounty-section"
          >
            <p className="font-mono text-xs text-gray-500">
              No active bounty for your club right now.{" "}
              <span className="text-gray-700 font-bold">Check back tomorrow</span> — bounties are
              generated nightly for bottom-ranked clubs!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
