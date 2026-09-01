import React, { useMemo } from "react";
import { Target, Flame, CheckCircle, AlertTriangle } from "lucide-react";

interface StudyGoalProgressProps {
  weeklyHoursCompleted: number;
  weeklyGoalHours: number;
  monthlyHoursCompleted: number;
  monthlyHoursTarget: number;
}

const RING_SIZE = 120;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Weekly goal progress ring and monthly target bar.
 * Shows whether the student is on pace to meet their study targets.
 */
export default function StudyGoalProgress({
  weeklyHoursCompleted,
  weeklyGoalHours,
  monthlyHoursCompleted,
  monthlyHoursTarget,
}: StudyGoalProgressProps) {
  const weeklyPct = useMemo(
    () => Math.min(100, Math.round((weeklyHoursCompleted / weeklyGoalHours) * 100)),
    [weeklyHoursCompleted, weeklyGoalHours],
  );

  const monthlyPct = useMemo(
    () => Math.min(100, Math.round((monthlyHoursCompleted / monthlyHoursTarget) * 100)),
    [monthlyHoursCompleted, monthlyHoursTarget],
  );

  const weeklyDashOffset = RING_CIRCUMFERENCE - (weeklyPct / 100) * RING_CIRCUMFERENCE;
  const weeklyCompleted = weeklyHoursCompleted >= weeklyGoalHours;

  return (
    <div className="space-y-6">
      {/* Weekly Goal Ring */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Target className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
            Weekly Study Goal
          </h3>
        </div>

        <div className="relative inline-block">
          <svg width={RING_SIZE} height={RING_SIZE} className="rotate-[-90deg]">
            {/* Background ring */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="rgb(30,41,59)"
              strokeWidth={RING_STROKE}
            />
            {/* Progress ring */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={weeklyCompleted ? "rgb(34,197,94)" : "rgb(6,182,212)"}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={weeklyDashOffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black font-mono text-white">{weeklyPct}%</span>
            <span className="text-[10px] font-mono text-slate-500 mt-0.5">
              {weeklyHoursCompleted.toFixed(1)} / {weeklyGoalHours}h
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {weeklyCompleted ? (
            <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" /> Goal met this week!
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              {(weeklyGoalHours - weeklyHoursCompleted).toFixed(1)}h remaining
            </span>
          )}
        </div>
      </div>

      {/* Monthly Progress Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              Monthly Target
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {monthlyHoursCompleted.toFixed(1)} / {monthlyHoursTarget}h
          </span>
        </div>

        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              monthlyPct >= 100
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                : monthlyPct >= 75
                  ? "bg-gradient-to-r from-cyan-500 to-emerald-400"
                  : monthlyPct >= 50
                    ? "bg-gradient-to-r from-cyan-600 to-cyan-400"
                    : "bg-gradient-to-r from-amber-600 to-amber-400"
            }`}
            style={{ width: `${monthlyPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] font-mono text-slate-500">{monthlyPct}% complete</span>
          {monthlyPct >= 100 ? (
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Target exceeded
            </span>
          ) : monthlyPct < 50 ? (
            <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Behind pace
            </span>
          ) : (
            <span className="text-[10px] font-mono text-cyan-400">On track</span>
          )}
        </div>

        {/* Monthly milestones */}
        <div className="flex items-center gap-1 mt-3">
          {[25, 50, 75, 100].map((milestone) => (
            <div
              key={milestone}
              className={`flex-1 h-1.5 rounded-full ${
                monthlyPct >= milestone ? "bg-cyan-500/60" : "bg-slate-800"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-1">
          {["25h", "50h", "75h", "100h"].map((label) => (
            <span key={label} className="text-[9px] font-mono text-slate-600">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
