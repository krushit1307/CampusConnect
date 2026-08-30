// =============================================================================
// Component: PollOverlay
//  Issue: #4166 - Build a 'Real-Time "Live Polling" Overlay for Streams'
//  Description: Renders the active poll as a translucent overlay on the video
//  player. Moderators see a "Launch Poll" trigger and "Close Poll" control.
//  Viewers see the question, vote buttons, and real-time bar chart results.
//  All updates are pushed via Supabase Realtime.
// =============================================================================

import React, { useState, useCallback } from "react";
import { useActivePoll } from "@/hooks/useActivePoll";
import { PollResultsChart } from "@/components/polls/PollResultsChart";
import { CreatePollDialog } from "@/components/polls/CreatePollDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import X from "lucide-react/dist/esm/icons/x";
import Check from "lucide-react/dist/esm/icons/check";
import type { User } from "@supabase/supabase-js";

interface PollOverlayProps {
  eventId: string;
  /** The full Supabase User object — null when logged out */
  user: User | null;
  /** Whether the current user has moderator privileges for this event */
  isModerator?: boolean;
}

export const PollOverlay: React.FC<PollOverlayProps> = ({ eventId, user, isModerator = false }) => {
  const userId = user?.id;
  const { activePoll, results, userVote, isLoading, isVoting, vote, closePoll, refetch } =
    useActivePoll(eventId, userId);

  const [isClosing, setIsClosing] = useState(false);

  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

  const handleClosePoll = useCallback(async () => {
    setIsClosing(true);
    try {
      await closePoll();
      toast.success("Poll closed");
    } catch {
      toast.error("Failed to close poll");
    } finally {
      setIsClosing(false);
    }
  }, [closePoll]);

  // ── No active poll ──────────────────────────────────────────────────
  if (!activePoll) {
    // Only moderators see the launch trigger
    if (!isModerator || !user) return null;

    return (
      <div className="absolute bottom-6 left-6 z-20">
        <CreatePollDialog eventId={eventId} user={user} onPollCreated={refetch} />
      </div>
    );
  }

  // ── Active poll overlay ─────────────────────────────────────────────
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 pointer-events-none"
      data-testid="poll-overlay"
    >
      <div className="pointer-events-auto mx-4 mb-16 max-w-sm rounded-xl border-2 border-white/20 bg-black/70 p-4 shadow-2xl backdrop-blur-md sm:mx-6">
        {/* ── Header ─────────────────────────────── */}
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-lime-400" />
          <h3 className="flex-1 font-display text-sm font-bold uppercase tracking-wider text-white">
            Live Poll
          </h3>
          <span className="animate-pulse rounded-full bg-lime-500 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black">
            Active
          </span>

          {/* Moderator: Close button */}
          {isModerator && (
            <button
              onClick={handleClosePoll}
              disabled={isClosing}
              className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-red-500/80 hover:text-white disabled:opacity-50"
              title="Close Poll"
              data-testid="poll-overlay-close"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* ── Question ────────────────────────────── */}
        <p className="mb-4 font-mono text-sm font-semibold text-white/90">{activePoll.question}</p>

        {/* ── Results (after voting) ──────────────── */}
        {userVote ? (
          <div className="space-y-2">
            {results.map((r) => {
              const pct = totalVotes > 0 ? Math.round((r.votes / totalVotes) * 100) : 0;
              const isSelected = r.optionId === userVote;
              return (
                <div
                  key={r.optionId}
                  className="relative overflow-hidden rounded-md bg-white/10 px-3 py-2"
                >
                  {/* Animated bar fill */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-md bg-lime-500/40 transition-all duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between">
                    <span
                      className={`font-mono text-xs font-bold ${isSelected ? "text-lime-300" : "text-white/80"}`}
                    >
                      {isSelected && <Check className="mr-1 inline h-3 w-3" />}
                      {r.text}
                    </span>
                    <span className="font-mono text-xs font-bold text-white/60">{pct}%</span>
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-center font-mono text-[10px] text-white/40">
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""} cast
            </p>
          </div>
        ) : (
          /* ── Voting buttons ──────────────────────── */
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center gap-2 py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span className="font-mono text-xs text-white/50">Loading…</span>
              </div>
            ) : (
              results.map((r, index) => (
                <button
                  key={r.optionId}
                  disabled={isVoting || !userId}
                  onClick={async () => {
                    if (!userId) {
                      toast.error("Please log in to vote");
                      return;
                    }
                    try {
                      await vote(r.optionId);
                    } catch {
                      toast.error("Failed to cast vote");
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-md bg-white/10 px-3 py-2.5 text-left font-mono text-xs font-bold text-white/90 transition-all duration-200 hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/20 text-[10px] font-bold text-white">
                    {String.fromCharCode(65 + index)}
                  </span>
                  {r.text}
                </button>
              ))
            )}
            <p className="pt-1 text-center font-mono text-[10px] text-white/40">
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""} so far
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
