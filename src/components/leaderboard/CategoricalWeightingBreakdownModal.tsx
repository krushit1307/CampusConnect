// =============================================================================
// File: src/components/leaderboard/CategoricalWeightingBreakdownModal.tsx
// Task: Dynamic Club Leaderboard — Categorical Weighting Point Allocation Engine
// Description: Interactive modal displaying the categorical weighting matrix
//              (1.40x to 1.00x multipliers) and detailed point breakdown per
//              activity category for selected campus clubs.
// =============================================================================

import {
  Target,
  Sparkles,
  Award,
  X,
  Layers,
  HelpCircle,
} from "lucide-react";
import {
  CATEGORY_WEIGHT_MULTIPLIERS,
  type UnderdogClubEntry,
  type ClubActivityCategory,
} from "@/services/underdogLeaderboardService";

export interface CategoricalWeightingBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  clubEntry?: UnderdogClubEntry;
}

export function CategoricalWeightingBreakdownModal({
  isOpen,
  onClose,
  clubEntry,
}: CategoricalWeightingBreakdownModalProps) {
  if (!isOpen) return null;

  const categoryMatrix: Array<{ category: ClubActivityCategory; multiplier: number; desc: string }> = [
    { category: "Academic & Research", multiplier: 1.40, desc: "STEM labs, hackathons, academic symposiums" },
    { category: "Community Service", multiplier: 1.30, desc: "Charity drives, volunteering, social impact" },
    { category: "Inter-Club Collaboration", multiplier: 1.25, desc: "Co-hosted events, cross-department alliances" },
    { category: "Professional & Career", multiplier: 1.15, desc: "Resume workshops, career fairs, mentorship" },
    { category: "Cultural & Arts", multiplier: 1.10, desc: "Performances, cultural showcases, art exhibits" },
    { category: "Social & Recreational", multiplier: 1.00, desc: "Pizza socials, gaming meetups, general gatherings" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      data-testid="categorical-modal-overlay"
    >
      <div
        className="relative w-full max-w-2xl border-4 border-black bg-white shadow-[8px_8px_0_0_#000] overflow-hidden flex flex-col max-h-[90vh]"
        data-testid="categorical-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-black bg-purple-400 p-4">
          <div className="flex items-center gap-3">
            <div className="border-2 border-black bg-black p-2 text-purple-300">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-black uppercase tracking-tight text-black">
                Categorical Point Weighting
              </h2>
              <p className="font-mono text-xs font-bold text-black/80">
                Impact-Based Point Scaling & Diversity Bonuses
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-black bg-white p-1 hover:bg-black hover:text-white cursor-pointer transition-colors"
            aria-label="Close modal"
            data-testid="categorical-modal-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Formula Explanation Banner */}
          <div className="border-2 border-black bg-purple-50 p-3.5 space-y-1.5 shadow-[2px_2px_0_0_#000]">
            <div className="flex items-center gap-2 font-mono text-xs font-black uppercase text-purple-950">
              <Sparkles className="h-4 w-4 text-purple-700" />
              How Categorical Weighting Works
            </div>
            <p className="font-mono text-xs text-purple-900 leading-relaxed">
              Points earned by clubs are scaled by event category impact. High-impact research (1.40x) and community service (1.30x) receive higher multipliers. Clubs hosting events across 3+ categories earn an additional <strong>+10% to +15% Diversity Bonus</strong>.
            </p>
          </div>

          {/* Club Specific Breakdown (If selected) */}
          {clubEntry && (
            <div
              className="border-3 border-black bg-yellow-50 p-4 space-y-3 shadow-[4px_4px_0_0_#000]"
              data-testid="selected-club-categorical-breakdown"
            >
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <div className="flex items-center gap-2.5">
                  {clubEntry.logo_url && (
                    <img
                      src={clubEntry.logo_url}
                      alt={clubEntry.club_name}
                      className="h-8 w-8 rounded-full border border-black object-cover"
                    />
                  )}
                  <h3 className="font-display text-base font-black uppercase text-black">
                    {clubEntry.club_name}
                  </h3>
                </div>

                <span className="border-2 border-black bg-purple-600 text-white font-mono text-xs font-bold px-2 py-0.5 uppercase">
                  Rank #{clubEntry.categorical_rank || clubEntry.rank_position}
                </span>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="border border-black bg-white p-2 text-center">
                  <span className="text-[10px] text-gray-600 font-bold uppercase block">Raw Points</span>
                  <span className="font-display text-lg font-black text-black">{clubEntry.raw_points}</span>
                </div>
                <div className="border border-black bg-purple-100 p-2 text-center">
                  <span className="text-[10px] text-purple-900 font-bold uppercase block">Weighted Score</span>
                  <span className="font-display text-lg font-black text-purple-700">
                    {clubEntry.categorical_points || clubEntry.raw_points}
                  </span>
                </div>
                <div className="border border-black bg-emerald-100 p-2 text-center">
                  <span className="text-[10px] text-emerald-900 font-bold uppercase block">Diversity Bonus</span>
                  <span className="font-display text-lg font-black text-emerald-700">
                    +{clubEntry.diversity_bonus || 0} pts
                  </span>
                </div>
              </div>

              {/* Per Category Breakdown Table */}
              {clubEntry.category_breakdown && (
                <div className="border border-black bg-white overflow-hidden">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-black bg-gray-100 text-[10px] text-gray-700 uppercase">
                        <th className="p-2">Category</th>
                        <th className="p-2 text-right">Raw</th>
                        <th className="p-2 text-right">Multiplier</th>
                        <th className="p-2 text-right">Weighted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clubEntry.category_breakdown.map((cb) => (
                        <tr key={cb.category} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-2 font-bold text-gray-900">{cb.category}</td>
                          <td className="p-2 text-right">{cb.rawPoints}</td>
                          <td className="p-2 text-right font-bold text-purple-700">{cb.weightMultiplier}x</td>
                          <td className="p-2 text-right font-black text-black">{cb.weightedPoints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Category Weight Matrix Legend */}
          <div className="border-2 border-black bg-white overflow-hidden shadow-[3px_3px_0_0_#000]">
            <div className="border-b-2 border-black bg-gray-100 px-3 py-2 flex items-center justify-between">
              <h3 className="font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-purple-600" />
                Category Impact Multipliers
              </h3>
              <span className="font-mono text-[10px] text-gray-600 font-bold uppercase">
                6 Standard Categories
              </span>
            </div>
            <table className="w-full border-collapse text-left font-mono text-xs">
              <thead>
                <tr className="border-b-2 border-black bg-gray-50 text-[10px] text-gray-700 uppercase">
                  <th className="p-2.5">Category Name</th>
                  <th className="p-2.5">Example Activities</th>
                  <th className="p-2.5 text-right">Multiplier</th>
                </tr>
              </thead>
              <tbody>
                {categoryMatrix.map((item) => (
                  <tr key={item.category} className="border-b border-gray-200 hover:bg-purple-50/40">
                    <td className="p-2.5 font-bold text-gray-900">{item.category}</td>
                    <td className="p-2.5 text-gray-600 text-[11px]">{item.desc}</td>
                    <td className="p-2.5 text-right font-display font-black text-sm text-purple-700">
                      {item.multiplier.toFixed(2)}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-4 border-black bg-gray-100 p-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-black bg-black text-white font-mono text-xs font-bold uppercase px-4 py-2 hover:bg-zinc-800 cursor-pointer shadow-[2px_2px_0_0_#000]"
            data-testid="categorical-modal-ok-btn"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}
