// =============================================================================
// Component: CrossClubMatchmakerWidget
// Issue: #3686 - Develop a 'Dynamic "Cross-Club Collaboration" Matchmaker'
// Description: Proactive AI suggestion widget detecting redundant event drafts across
// campus clubs (> 85% similarity) and providing a 1-click "Propose Co-Host" action
// to merge drafts and pool budgets.
// =============================================================================

import React, { useState, useEffect } from "react";
import {
  checkForCrossClubMatches,
  acceptCoHostCollaboration,
  type CrossClubMatch,
} from "@/services/crossClubMatchmaker";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Users from "lucide-react/dist/esm/icons/users";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";

interface CrossClubMatchmakerWidgetProps {
  draftId: string;
  clubId: string;
  title: string;
  description?: string;
  budget?: number;
  onCoHostAccepted?: (pooledBudget: number) => void;
}

export function CrossClubMatchmakerWidget({
  draftId,
  clubId,
  title,
  description = "",
  budget = 100,
  onCoHostAccepted,
}: CrossClubMatchmakerWidgetProps) {
  const [matches, setMatches] = useState<CrossClubMatch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [acceptedMatchId, setAcceptedMatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId || !clubId || !title) {
      setMatches([]);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      const res = await checkForCrossClubMatches(draftId, clubId, title, description, budget);
      setMatches(res.matches);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [draftId, clubId, title, description, budget]);

  if (isLoading || matches.length === 0) return null;

  const topMatch = matches[0];
  const similarityPct = Math.round(topMatch.similarity_score * 100);
  const isAccepted = acceptedMatchId === topMatch.id || topMatch.status === "ACCEPTED";

  const handleAcceptCoHost = async () => {
    const res = await acceptCoHostCollaboration(topMatch.id, topMatch);
    if (res.success) {
      setAcceptedMatchId(topMatch.id);
      if (onCoHostAccepted && res.pooledBudget) {
        onCoHostAccepted(res.pooledBudget);
      }
    }
  };

  return (
    <div
      data-testid="cross-club-matchmaker-widget"
      className={`border rounded-2xl p-6 shadow-xl transition-all duration-300 my-6 ${
        isAccepted
          ? "bg-emerald-950/80 border-emerald-500 text-emerald-100"
          : "bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-purple-500/80 text-slate-100"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-2xl shrink-0 ${isAccepted ? "bg-emerald-600 text-white" : "bg-purple-600 text-white shadow-lg shadow-purple-600/30"}`}
          >
            {isAccepted ? <CheckCircle2 className="w-7 h-7" /> : <Sparkles className="w-7 h-7" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base md:text-lg font-black uppercase tracking-wider text-white">
                {isAccepted
                  ? "Co-Host Partnership Established!"
                  : `✨ CROSS-CLUB COLLABORATION MATCH (${similarityPct}% Similarity)`}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/30 text-purple-300 border border-purple-400/40">
                AI MATCHMAKER
              </span>
            </div>

            <p className="text-xs md:text-sm text-slate-200 mt-1 leading-relaxed">
              {isAccepted ? (
                <>
                  Merged draft with <strong>{topMatch.club_b_name}</strong> into a single Co-Hosted
                  event! Combined pooled budget:{" "}
                  <span className="text-emerald-300 font-extrabold font-mono">
                    ${topMatch.pooled_budget}
                  </span>
                  .
                </>
              ) : (
                <>
                  The <strong>{topMatch.club_b_name}</strong> is planning a very similar event!
                  Combine forces to pool budgets (
                  <span className="font-mono text-purple-300">${topMatch.draft_a_budget}</span> +{" "}
                  <span className="font-mono text-purple-300">${topMatch.draft_b_budget}</span> ={" "}
                  <span className="font-mono text-emerald-400 font-bold">
                    ${topMatch.pooled_budget} total
                  </span>
                  ) and host one massive event.
                </>
              )}
            </p>
          </div>
        </div>

        {/* 1-Click Action Buttons */}
        {!isAccepted && (
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleAcceptCoHost}
              data-testid="accept-cohost-btn"
              className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-lg hover:shadow-purple-500/20 flex items-center justify-center gap-2 active:scale-95"
            >
              <Users className="w-4 h-4" />
              <span>Propose Co-Host & Pool Budgets (${topMatch.pooled_budget})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
