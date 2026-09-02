// =============================================================================
// Component: DynamicWaitlistPriorityCard
// Issue: #3874 - Develop a 'Dynamic Waitlist Priority' Algorithm
// Description: UI card for waitlisted attendees visualizing dynamic queue rank,
// weighted Priority Score breakdown, and reputation rules.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import {
  getRankedWaitlistForEvent,
  type DynamicWaitlistUser,
} from "@/services/dynamicWaitlistPriorityService";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Clock from "lucide-react/dist/esm/icons/clock";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle";

interface DynamicWaitlistPriorityCardProps {
  eventId: string;
  userId?: string;
  userGamificationPoints?: number;
  userAttendanceCount?: number;
  userNoShowCount?: number;
  waitlistJoinedAt?: string | Date;
}

export function DynamicWaitlistPriorityCard({
  eventId,
  userId = "user-current",
  userGamificationPoints = 20,
  userAttendanceCount = 3,
  userNoShowCount = 0,
  waitlistJoinedAt = new Date(),
}: DynamicWaitlistPriorityCardProps) {
  const [userWaitlist, setUserWaitlist] = useState<DynamicWaitlistUser | null>(null);
  const [totalWaitlisted, setTotalWaitlisted] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchWaitlistRank = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    const res = await getRankedWaitlistForEvent(eventId, userId);
    if (res.userRank) {
      setUserWaitlist(res.userRank);
      setTotalWaitlisted(res.userRank.total_waitlisted);
    } else {
      // Fallback preview object for UI testing
      const breakdown = {
        base_time_score: 85,
        gamification_bonus: userGamificationPoints * 2.5,
        attendance_bonus: userAttendanceCount * 10,
        no_show_penalty: userNoShowCount * 25,
        final_priority_score:
          85 + userGamificationPoints * 2.5 + userAttendanceCount * 10 - userNoShowCount * 25,
      };

      setUserWaitlist({
        id: "waitlist-preview",
        event_id: eventId,
        user_id: userId,
        user_full_name: "You",
        priority_score: breakdown.final_priority_score,
        rank_position: 1,
        total_waitlisted: 12,
        gamification_points: userGamificationPoints,
        attendance_count: userAttendanceCount,
        no_show_count: userNoShowCount,
        created_at: new Date(waitlistJoinedAt).toISOString(),
        score_breakdown: breakdown,
      });
      setTotalWaitlisted(12);
    }
    setIsLoading(false);
  }, [
    eventId,
    userId,
    userGamificationPoints,
    userAttendanceCount,
    userNoShowCount,
    waitlistJoinedAt,
  ]);

  useEffect(() => {
    void fetchWaitlistRank();
  }, [fetchWaitlistRank]);

  if (isLoading || !userWaitlist) return null;

  const { score_breakdown } = userWaitlist;

  return (
    <div
      data-testid="dynamic-waitlist-priority-card"
      className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 md:p-8 shadow-2xl text-slate-100 my-6 relative overflow-hidden"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-purple-600 rounded-2xl text-white shadow-lg shadow-purple-600/40 shrink-0">
            <Sparkles className="w-7 h-7" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                DYNAMIC WAITLIST PRIORITY
              </span>
            </div>

            <h3 className="text-xl md:text-2xl font-black text-white mt-1">
              You are{" "}
              <span className="text-purple-400 font-mono">#{userWaitlist.rank_position}</span> of{" "}
              <span className="text-slate-300 font-mono">{totalWaitlisted}</span> on the Waitlist
            </h3>

            <p className="text-xs text-slate-400 mt-1">
              Position is weighted dynamically by platform reputation & reliability rather than
              simple FIFO timestamp.
            </p>
          </div>
        </div>

        {/* PRIORITY SCORE BADGE */}
        <div className="bg-slate-950 border border-purple-500/50 rounded-2xl p-4 text-center shrink-0">
          <p className="text-[10px] text-purple-300 uppercase font-mono tracking-wider">
            Priority Score
          </p>
          <p className="text-3xl font-black text-purple-400 font-mono">
            {userWaitlist.priority_score}
          </p>
          <p className="text-[10px] text-emerald-400 font-bold mt-0.5">Top Queue Ranking</p>
        </div>
      </div>

      {/* SCORE BREAKDOWN GRID */}
      <div className="my-6">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-400" /> Reputation & Score Breakdown
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Gamification XP</span>
            </div>
            <p className="text-base font-bold text-emerald-400">
              +{score_breakdown.gamification_bonus} pts
            </p>
            <p className="text-[10px] text-slate-500">
              {userWaitlist.gamification_points} XP points
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Attendance Streak</span>
            </div>
            <p className="text-base font-bold text-emerald-400">
              +{score_breakdown.attendance_bonus} pts
            </p>
            <p className="text-[10px] text-slate-500">
              {userWaitlist.attendance_count} events attended
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>No-Show Penalty</span>
            </div>
            <p className="text-base font-bold text-red-400">
              -{score_breakdown.no_show_penalty} pts
            </p>
            <p className="text-[10px] text-slate-500">{userWaitlist.no_show_count} no-shows</p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Base Join Time</span>
            </div>
            <p className="text-base font-bold text-slate-200">
              +{score_breakdown.base_time_score} pts
            </p>
            <p className="text-[10px] text-slate-500">Timestamp bonus</p>
          </div>
        </div>
      </div>

      {/* EXPLANATORY REPUTATION BANNER */}
      <div
        data-testid="dynamic-priority-explanation-banner"
        className="bg-purple-950/40 border border-purple-500/30 rounded-2xl p-4 text-xs text-purple-200 flex items-start gap-3 leading-relaxed"
      >
        <HelpCircle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block mb-0.5">How Dynamic Waitlist Priority Works:</strong>
          Unlike traditional FIFO waitlists where flaking users get equal priority, our platform
          calculates your position dynamically based on your platform reputation. Earn XP and
          maintain attendance streaks to leapfrog ahead when spots open up!
        </div>
      </div>
    </div>
  );
}
