// =============================================================================
// Component: JuryReviewCard
// Issue: #5129 - Automated "Profanity/Harassment" Decentralized Content Moderation DAO
// Description: Juror review component providing blind voting interface (Violates Policy vs Looks Fine),
// submitted state feedback, and 50-point reward notification upon 4-of-5 consensus resolution.
// =============================================================================

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Scale,
  Award,
  CheckCircle2,
  AlertOctagon,
  Info,
} from "lucide-react";
import { globalJuryModerationService } from "@/services/juryModerationService";
import { BlindJuryCaseView, JuryVoteDecision } from "@/types/juryModeration";

export interface JuryReviewCardProps {
  caseId: string;
  jurorId: string;
  className?: string;
  onVoteSubmitted?: (decision: JuryVoteDecision) => void;
}

export const JuryReviewCard: React.FC<JuryReviewCardProps> = ({
  caseId,
  jurorId,
  className = "",
  onVoteSubmitted,
}) => {
  const [caseView, setCaseView] = useState<BlindJuryCaseView | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load blind case view
  const loadCase = () => {
    const view = globalJuryModerationService.getBlindCaseView(caseId, jurorId);
    setCaseView(view);
  };

  useEffect(() => {
    loadCase();
  }, [caseId, jurorId]);

  const handleVote = (decision: JuryVoteDecision) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const result = globalJuryModerationService.submitVote(caseId, jurorId, decision);

    if (!result.success) {
      setErrorMessage(result.message);
    } else {
      if (onVoteSubmitted) onVoteSubmitted(decision);
      loadCase();
    }

    setIsSubmitting(false);
  };

  if (!caseView) {
    return (
      <div
        className={`rounded-3xl bg-slate-900 border border-slate-800 p-6 text-slate-400 font-mono text-center ${className}`}
      >
        No active jury assignment found for case #{caseId} or unauthorized access.
      </div>
    );
  }

  const isResolved = caseView.isResolved;
  const hasVoted = caseView.hasVoted;

  return (
    <div
      data-testid="jury-review-card"
      className={`rounded-3xl bg-slate-900 border border-indigo-500/30 p-6 shadow-2xl space-y-6 text-slate-100 relative overflow-hidden ${className}`}
    >
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <Scale className="w-6 h-6 text-amber-400" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                JURY DUTY ⚖️
              </span>
              <span className="text-xs text-slate-400 font-mono">Blind Voting Case #{caseId}</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">Content Moderation DAO Case</h2>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isResolved ? (
            <span
              data-testid="status-resolved-badge"
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                caseView.consensusDecision === "violates_policy"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              }`}
            >
              RESOLVED:{" "}
              {caseView.consensusDecision === "violates_policy" ? "VIOLATION" : "LOOKS FINE"}
            </span>
          ) : hasVoted ? (
            <span
              data-testid="status-voted-badge"
              className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>VOTE SUBMITTED</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
              AWAITING YOUR VOTE
            </span>
          )}
        </div>
      </div>

      {/* Reported Content Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
          <span>Flagged Content Preview</span>
          <span className="text-indigo-400 font-mono">Category: {caseView.category}</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm font-sans text-slate-200 leading-relaxed italic relative">
          "{caseView.contentPreview}"
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Report Reason: <strong>{caseView.reason}</strong>
          </span>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Blind Voting Buttons / State */}
      {!hasVoted && !isResolved ? (
        <div className="space-y-3 pt-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Cast Your Blind Vote (4 of 5 Consensus Required)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleVote("violates_policy")}
              disabled={isSubmitting}
              data-testid="vote-violates-btn"
              className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-rose-900/40 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 font-bold text-sm transition shadow-lg shadow-rose-950/50 active:scale-95 disabled:opacity-50"
            >
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span>Violates Policy</span>
            </button>

            <button
              onClick={() => handleVote("looks_fine")}
              disabled={isSubmitting}
              data-testid="vote-fine-btn"
              className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-emerald-900/40 hover:bg-emerald-900/70 border border-emerald-500/40 text-emerald-200 font-bold text-sm transition shadow-lg shadow-emerald-950/50 active:scale-95 disabled:opacity-50"
            >
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Looks Fine</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              Your blind vote:{" "}
              <strong className="text-white uppercase font-mono">
                {caseView.userVote?.replace("_", " ")}
              </strong>
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Your vote is encrypted and kept private. Other jurors cannot see your choice or
            identity.
          </p>
        </div>
      )}

      {/* Gamification Points Reward Banner */}
      {caseView.rewardPointsEarned && caseView.rewardPointsEarned > 0 ? (
        <div
          data-testid="reward-points-banner"
          className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border border-amber-500/40 text-amber-200 flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                Jury Duty Reward Granted!
              </div>
              <div className="text-xs text-slate-300">
                Thank you for helping keep CampusConnect safe.
              </div>
            </div>
          </div>

          <div className="text-lg font-black font-mono text-amber-300 bg-slate-950 px-3 py-1 rounded-xl border border-amber-500/30">
            +50 XP
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default JuryReviewCard;
