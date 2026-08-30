import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { StudyHourEntry } from "@/hooks/useStudyGroupAnalytics";

interface StudyHourChartProps {
  data: StudyHourEntry[];
  visibleWeeks?: number;
}

const BAR_WIDTH = 18;
const BAR_GAP = 4;
const CHART_HEIGHT = 180;

/**
 * Scrollable bar chart showing weekly study hours with target lines,
 * goal-met indicators, and a trend direction badge.
 */
export default function StudyHourChart({ data, visibleWeeks = 12 }: StudyHourChartProps) {
  const [offset, setOffset] = useState(Math.max(0, data.length - visibleWeeks));

  const visibleData = useMemo(
    () => data.slice(offset, offset + visibleWeeks),
    [data, offset, visibleWeeks],
  );

  const maxHours = useMemo(
    () => Math.max(...visibleData.map((d) => Math.max(d.hours, d.target)), 1),
    [visibleData],
  );

  const totalWidth = visibleWeeks * (BAR_WIDTH + BAR_GAP);

  const trend = useMemo(() => {
    if (visibleData.length < 2) return "stable";
    const recent = visibleData.slice(-3).reduce((s, d) => s + d.hours, 0) / 3;
    const earlier = visibleData.slice(0, 3).reduce((s, d) => s + d.hours, 0) / 3;
    if (recent > earlier * 1.15) return "up";
    if (recent < earlier * 0.85) return "down";
    return "stable";
  }, [visibleData]);

  const canGoBack = offset > 0;
  const canGoForward = offset + visibleWeeks < data.length;

  return (
    <div className="space-y-3">
      {/* Header row with trend + navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {trend === "up" && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
              <TrendingUp className="w-3.5 h-3.5" /> trending up
            </span>
          )}
          {trend === "down" && (
            <span className="flex items-center gap-1 text-xs text-rose-400 font-mono">
              <TrendingDown className="w-3.5 h-3.5" /> trending down
            </span>
          )}
          {trend === "stable" && (
            <span className="flex items-center gap-1 text-xs text-slate-500 font-mono">
              <Minus className="w-3.5 h-3.5" /> steady
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={!canGoBack}
            className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setOffset((o) => Math.min(data.length - visibleWeeks, o + 1))}
            disabled={!canGoForward}
            className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Bar Chart */}
      <div className="overflow-x-auto">
        <svg
          width={totalWidth + 30}
          height={CHART_HEIGHT + 50}
          className="select-none"
          aria-label="Weekly study hours bar chart"
          role="img"
        >
          {/* Y-axis grid lines and labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = CHART_HEIGHT - pct * CHART_HEIGHT + 5;
            const val = Math.round(maxHours * pct);
            return (
              <g key={pct}>
                <line
                  x1={25}
                  y1={y}
                  x2={totalWidth + 30}
                  y2={y}
                  stroke="rgb(51,65,85)"
                  strokeWidth={0.5}
                  strokeDasharray={pct === 0 ? "0" : "3,3"}
                />
                <text
                  x={22}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-500"
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {val}h
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {visibleData.map((entry, i) => {
            const x = 28 + i * (BAR_WIDTH + BAR_GAP);
            const barHeight = (entry.hours / maxHours) * CHART_HEIGHT;
            const targetHeight = (entry.target / maxHours) * CHART_HEIGHT;
            const y = CHART_HEIGHT - barHeight + 5;
            const targetY = CHART_HEIGHT - targetHeight + 5;
            const meetsGoal = entry.hours >= entry.target;

            return (
              <g key={i}>
                {/* Target line */}
                <line
                  x1={x - 1}
                  y1={targetY}
                  x2={x + BAR_WIDTH + 1}
                  y2={targetY}
                  stroke="rgb(148,163,184)"
                  strokeWidth={1}
                  strokeDasharray="2,2"
                  opacity={0.5}
                />

                {/* Hours bar */}
                <rect
                  x={x}
                  y={y}
                  width={BAR_WIDTH}
                  height={Math.max(barHeight, 2)}
                  rx={4}
                  className={
                    meetsGoal
                      ? "fill-cyan-500/80 hover:fill-cyan-400 transition-colors"
                      : "fill-cyan-800/60 hover:fill-cyan-700/70 transition-colors"
                  }
                />

                {/* Goal met indicator dot */}
                {meetsGoal && barHeight > 10 && (
                  <circle cx={x + BAR_WIDTH / 2} cy={y + 6} r={3} className="fill-emerald-400" />
                )}

                {/* Week label (rotated) */}
                <text
                  x={x + BAR_WIDTH / 2}
                  y={CHART_HEIGHT + 20}
                  textAnchor="middle"
                  className="fill-slate-500"
                  fontSize={8}
                  fontFamily="monospace"
                  transform={`rotate(-45, ${x + BAR_WIDTH / 2}, ${CHART_HEIGHT + 20})`}
                >
                  {entry.week}
                </text>

                {/* Numeric value above bar */}
                {barHeight > 15 && (
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={y - 4}
                    textAnchor="middle"
                    className="fill-slate-400"
                    fontSize={8}
                    fontFamily="monospace"
                  >
                    {entry.hours.toFixed(1)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-cyan-500/80 inline-block" />
          Hours studied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-px bg-slate-500 border-t border-dashed inline-block" />
          Weekly target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          Goal met
        </span>
      </div>
    </div>
  );
}
