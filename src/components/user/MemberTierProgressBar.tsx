import React from "react";
import { Trophy, Award, Sparkles, ChevronRight, Zap, CheckCircle2 } from "lucide-react";
import { getNextTierProgress, MEMBER_TIERS } from "@/lib/memberTiers";
import { MemberTierAvatar } from "./MemberTierAvatar";
import { cn } from "@/lib/utils";

export interface MemberTierProgressBarProps {
  points: number;
  userName?: string;
  avatarUrl?: string | null;
  className?: string;
}

export const MemberTierProgressBar: React.FC<MemberTierProgressBarProps> = ({
  points = 0,
  userName = "Club Member",
  avatarUrl,
  className,
}) => {
  const { currentTier, nextTier, pointsRemaining, progressPercent } = getNextTierProgress(points);

  return (
    <div
      data-testid="member-tier-progress-card"
      className={cn(
        "border-2 border-black p-6 bg-white rounded-xl space-y-5 font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        className
      )}
    >
      {/* Top Status Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MemberTierAvatar src={avatarUrl} alt={userName} points={points} size="lg" showBadgeOverlay />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-black">{userName}</h3>
              <span
                className={cn(
                  "px-2.5 py-0.5 text-xs font-bold uppercase border border-black rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
                  currentTier.badgeBg
                )}
              >
                {currentTier.badge}
              </span>
            </div>
            <p className="text-xs font-sans text-gray-700 mt-1 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span className="font-bold text-black">{points.toLocaleString()}</span> Gamification Points
            </p>
          </div>
        </div>

        {nextTier ? (
          <div className="text-left sm:text-right bg-amber-50 border border-amber-300 p-2.5 rounded-lg">
            <span className="text-[11px] font-bold uppercase text-amber-900 block">Next Goal</span>
            <span className="text-xs font-bold text-black">
              {pointsRemaining.toLocaleString()} pts to {nextTier.name} Tier
            </span>
          </div>
        ) : (
          <div className="bg-cyan-100 border border-cyan-400 px-3 py-1.5 rounded-lg text-cyan-950 font-bold text-xs flex items-center gap-1.5 animate-pulse">
            <Sparkles className="w-4 h-4 text-cyan-600" />
            <span>Highest Tier Unlocked!</span>
          </div>
        )}
      </div>

      {/* Progress Bar Component (#3461) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-bold">
          <span className="text-gray-700">
            {currentTier.name} ({currentTier.minPoints} pts)
          </span>
          {nextTier ? (
            <span className="text-purple-700">
              {nextTier.name} ({nextTier.minPoints} pts)
            </span>
          ) : (
            <span className="text-cyan-700">Platinum Elite</span>
          )}
        </div>

        {/* Outer Bar Track */}
        <div className="h-4 w-full bg-gray-100 border-2 border-black rounded-full overflow-hidden p-0.5 relative">
          <div
            data-testid="tier-progress-fill"
            className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="text-xs font-sans text-gray-600 text-center pt-1">
          {nextTier ? (
            <>
              You are <span className="font-bold text-black">{pointsRemaining.toLocaleString()} points</span> away from unlocking{" "}
              <span className="font-bold text-purple-700">{nextTier.name} Tier</span>!
            </>
          ) : (
            "Congratulations! You've achieved Platinum status — enjoying maximum perks and shimmering avatar flair."
          )}
        </p>
      </div>

      {/* Unlocked Perks List */}
      <div className="border-t-2 border-black/10 pt-4 space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider block text-gray-800">
          Unlocked {currentTier.name} Tier Perks:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
          {currentTier.perks.map((perk, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-2 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{perk}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
