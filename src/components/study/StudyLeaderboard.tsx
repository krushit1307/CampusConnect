import React, { useState } from "react";
import {
  Trophy,
  TrendingUp,
  Users,
  Clock,
  Award,
  ChevronDown,
  ChevronUp,
  Target,
} from "lucide-react";
import type { StudyGroupRanking } from "@/hooks/useStudyGroupAnalytics";

interface StudyLeaderboardProps {
  rankings: StudyGroupRanking[];
}

const RANK_COLORS = [
  "from-amber-500 to-yellow-400",
  "from-slate-300 to-slate-200",
  "from-orange-600 to-amber-700",
];

/**
 * Expandable leaderboard ranking study groups by a composite performance
 * score weighing attendance, retention, and active study hours.
 */
export default function StudyLeaderboard({ rankings }: StudyLeaderboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(rankings[0]?.groupId || null);

  return (
    <div className="space-y-2">
      {rankings.map((group) => {
        const isExpanded = expandedId === group.groupId;
        const isTop3 = group.rank <= 3;
        const score = Math.round(
          group.avgAttendance * 0.3 +
            group.memberRetentionRate * 0.4 +
            group.weeklyActiveHours * 0.3,
        );

        return (
          <div
            key={group.groupId}
            className={`rounded-xl border transition-all duration-300 ${
              isTop3
                ? "bg-slate-900/80 border-slate-700/60 hover:border-slate-600"
                : "bg-slate-900/50 border-slate-800/60 hover:border-slate-700"
            }`}
          >
            {/* Main Row */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : group.groupId)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              {/* Rank Badge */}
              <div className="relative shrink-0">
                {isTop3 ? (
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-br ${RANK_COLORS[group.rank - 1]} flex items-center justify-center shadow-lg`}
                  >
                    <span className="text-sm font-black text-white drop-shadow">
                      {group.rank === 1 ? <Trophy className="w-4 h-4 text-white" /> : group.rank}
                    </span>
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <span className="text-sm font-mono font-bold text-slate-400">{group.rank}</span>
                  </div>
                )}
              </div>

              {/* Group Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                    {group.courseCode}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-200 truncate">
                    {group.groupName}
                  </h4>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-mono text-slate-500">
                    Score: <span className="text-slate-300 font-bold">{score}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-600">|</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                    {group.weeklyActiveHours}h/wk
                  </span>
                </div>
              </div>

              {/* Expand Icon */}
              <div className="shrink-0 text-slate-500">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-800/60">
                <div className="grid grid-cols-2 gap-3">
                  <StatItem
                    icon={<Target className="w-3.5 h-3.5" />}
                    label="Avg Attendance"
                    value={`${group.avgAttendance}%`}
                    color="text-cyan-400"
                  />
                  <StatItem
                    icon={<Award className="w-3.5 h-3.5" />}
                    label="Retention Rate"
                    value={`${group.memberRetentionRate}%`}
                    color="text-emerald-400"
                  />
                  <StatItem
                    icon={<Users className="w-3.5 h-3.5" />}
                    label="Total Sessions"
                    value={group.totalSessions.toString()}
                    color="text-indigo-400"
                  />
                  <StatItem
                    icon={<TrendingUp className="w-3.5 h-3.5" />}
                    label="Avg Hrs/Session"
                    value={group.avgHoursPerSession.toFixed(1)}
                    color="text-amber-400"
                  />
                </div>

                {/* Composite score progress bar */}
                <div className="mt-3 bg-slate-950 rounded-lg p-2.5 border border-slate-800/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      Composite Score
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-300">{score}/100</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        score >= 80
                          ? "bg-gradient-to-r from-cyan-500 to-emerald-400"
                          : score >= 60
                            ? "bg-gradient-to-r from-cyan-600 to-cyan-400"
                            : "bg-gradient-to-r from-amber-600 to-amber-400"
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className={`text-base font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}
