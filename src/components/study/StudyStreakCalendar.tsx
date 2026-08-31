import React, { useMemo } from "react";
import subDays from "date-fns/subDays";
import format from "date-fns/format";
import getDay from "date-fns/getDay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { StudyActivity } from "@/hooks/useStudyGroupAnalytics";

interface StudyStreakCalendarProps {
  activity: StudyActivity[];
  weeksToShow?: number;
}

const CELL_SIZE = 13;
const CELL_GAP = 3;
const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

function getIntensityLevel(hours: number): number {
  if (hours <= 0) return 0;
  if (hours < 1) return 1;
  if (hours < 2) return 2;
  if (hours < 3) return 3;
  return 4;
}

const INTENSITY_CLASSES = [
  "bg-slate-800/60",
  "bg-cyan-900/60",
  "bg-cyan-700/70",
  "bg-cyan-500/80",
  "bg-cyan-400",
];

const INTENSITY_BORDER = [
  "border-slate-700/40",
  "border-cyan-800/50",
  "border-cyan-600/60",
  "border-cyan-400/70",
  "border-cyan-300",
];

/**
 * GitHub-style contribution heatmap calendar showing daily study activity.
 * Cells are colour-coded by intensity (hours studied) and show rich
 * tooltips on hover with session details.
 */
export default function StudyStreakCalendar({
  activity,
  weeksToShow = 26,
}: StudyStreakCalendarProps) {
  const today = new Date();
  const startDate = subDays(
    today,
    weeksToShow * 7 - 1 + getDay(today === undefined ? new Date() : today),
  );

  const activityMap = useMemo(() => {
    const map = new Map<string, StudyActivity>();
    activity.forEach((a) => map.set(a.date, a));
    return map;
  }, [activity]);

  const cells = useMemo(() => {
    const result: {
      date: Date;
      dateStr: string;
      activity: StudyActivity | null;
      level: number;
    }[] = [];
    let current = new Date(startDate);

    while (current <= today) {
      const dateStr = format(current, "yyyy-MM-dd");
      const dayActivity = activityMap.get(dateStr) || null;
      result.push({
        date: new Date(current),
        dateStr,
        activity: dayActivity,
        level: getIntensityLevel(dayActivity?.hoursStudied || 0),
      });
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
    return result;
  }, [startDate, today, activityMap]);

  // Group cells by week (column)
  const weeks = useMemo(() => {
    const grouped: (typeof cells)[] = [];
    let currentWeek: typeof cells = [];
    let lastDay = -1;

    cells.forEach((cell) => {
      const dayOfWeek = getDay(cell.date);
      if (dayOfWeek <= lastDay && currentWeek.length > 0) {
        grouped.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(cell);
      lastDay = dayOfWeek;
    });
    if (currentWeek.length > 0) grouped.push(currentWeek);
    return grouped;
  }, [cells]);

  const gridWidth = weeks.length * (CELL_SIZE + CELL_GAP) + 30;
  const gridHeight = 7 * (CELL_SIZE + CELL_GAP) + 20;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto pb-2">
        <svg
          width={gridWidth}
          height={gridHeight}
          className="select-none"
          aria-label="Study activity heatmap for the last 6 months"
          role="img"
        >
          {/* Day-of-week labels */}
          {DAY_LABELS.map((label, i) => (
            <text
              key={i}
              x={0}
              y={20 + i * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2}
              dominantBaseline="middle"
              className="fill-slate-500"
              fontSize={10}
              fontFamily="monospace"
            >
              {label}
            </text>
          ))}

          {/* Heatmap cells */}
          {weeks.map((week, wi) =>
            week.map((cell) => {
              const row = getDay(cell.date);
              const x = 30 + wi * (CELL_SIZE + CELL_GAP);
              const y = 18 + row * (CELL_SIZE + CELL_GAP);
              const formattedDate = format(cell.date, "EEE, MMM d, yyyy");
              const hours = cell.activity?.hoursStudied || 0;
              const sessions = cell.activity?.sessionsAttended || 0;

              return (
                <Tooltip key={cell.dateStr}>
                  <TooltipTrigger asChild>
                    <rect
                      x={x}
                      y={y}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      rx={2.5}
                      className={`${INTENSITY_CLASSES[cell.level]} ${INTENSITY_BORDER[cell.level]} border-[0.5px] transition-all hover:stroke-cyan-300 hover:stroke-[2px] cursor-pointer`}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="center"
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono shadow-xl rounded-lg px-3 py-2"
                  >
                    <div className="font-semibold text-slate-100">{formattedDate}</div>
                    {hours > 0 ? (
                      <div className="mt-1 space-y-0.5 text-slate-400">
                        <div>
                          <span className="text-cyan-400 font-bold">{hours.toFixed(1)}h</span>{" "}
                          studied
                        </div>
                        <div>
                          <span className="text-cyan-400 font-bold">{sessions}</span> session
                          {sessions !== 1 ? "s" : ""} attended
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-500 mt-1">No study sessions</div>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            }),
          )}
        </svg>
      </div>
    </TooltipProvider>
  );
}

export function StreakCalendarLegend() {
  return (
    <div className="flex items-center gap-2 mt-3">
      <span className="text-[10px] font-mono text-slate-500">Less</span>
      {[0, 1, 2, 3, 4].map((level) => (
        <div
          key={level}
          className={`w-[13px] h-[13px] rounded-sm border-[0.5px] ${INTENSITY_CLASSES[level]} ${INTENSITY_BORDER[level]}`}
        />
      ))}
      <span className="text-[10px] font-mono text-slate-500">More</span>
    </div>
  );
}
