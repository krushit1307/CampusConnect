import React, { useEffect } from "react";
import {
  UserSeriesProgress,
  EventSeries,
  EventSeriesProgressionService,
} from "@/services/eventSeriesProgressionService";
import { Award, Trophy, PartyPopper, CheckCircle, Sparkles, X, ArrowRight } from "lucide-react";

interface SeriesCompletionCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  series: EventSeries;
  progress: UserSeriesProgress;
  onRewardClaimed: () => void;
}

export const SeriesCompletionCelebrationModal: React.FC<SeriesCompletionCelebrationModalProps> = ({
  isOpen,
  onClose,
  series,
  progress,
  onRewardClaimed,
}) => {
  useEffect(() => {
    // Play celebratory sound or log confetti effect trigger
    if (isOpen) {
      console.log("🎉 Triggering 100% Event Series Confetti Gamification!");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClaim = () => {
    try {
      EventSeriesProgressionService.claimReward(progress.userId, series.id);
      onRewardClaimed();
    } catch (err) {
      console.error("Claim reward error:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 shadow-2xl p-6 sm:p-8 text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Big Trophy Badge with Animated Halo */}
        <div className="relative mx-auto w-24 h-24 mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-pink-500 blur-xl opacity-60 animate-pulse" />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-900 shadow-xl border-4 border-white dark:border-slate-800">
            <Trophy className="w-10 h-10 animate-bounce" />
          </div>
        </div>

        {/* Celebration Badges */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider mb-2">
          <PartyPopper className="w-3.5 h-3.5 text-purple-500" />
          100% Series Completion Master
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Congratulations, {progress.userName}!
        </h2>

        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
          You have successfully attended all{" "}
          <span className="font-bold text-purple-600 dark:text-purple-400">
            {series.totalEvents} sessions
          </span>{" "}
          of <span className="font-semibold">{series.title}</span>!
        </p>

        {/* Reward Card */}
        <div className="my-6 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200 dark:border-purple-800/60 p-4 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-md">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-300">
                Unlocked Series Reward
              </div>
              <div className="font-bold text-slate-900 dark:text-white text-base">
                {series.rewardTitle}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official accreditation certificate, demo day pitch access, and verified completion
                badge on your CampusConnect profile.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {progress.rewardClaimed ? (
            <div className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
              <CheckCircle className="w-4 h-4" /> Reward Claimed Successfully!
            </div>
          ) : (
            <button
              onClick={handleClaim}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all hover:scale-105"
            >
              <Sparkles className="w-4 h-4" /> Claim Funding Eligibility & Certificate
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-3 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
