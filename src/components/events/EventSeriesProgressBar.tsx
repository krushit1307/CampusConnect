import React from "react";
import { CheckCircle2, Circle, Sparkles, Award } from "lucide-react";

interface EventSeriesProgressBarProps {
  eventsAttended: number;
  totalEvents: number;
  completionPercentage: number;
  seriesTitle?: string;
  isCompleted?: boolean;
}

export const EventSeriesProgressBar: React.FC<EventSeriesProgressBarProps> = ({
  eventsAttended,
  totalEvents,
  completionPercentage,
  seriesTitle,
  isCompleted = false,
}) => {
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          {isCompleted ? (
            <Award className="w-4 h-4 text-emerald-500" />
          ) : (
            <Sparkles className="w-4 h-4 text-purple-500" />
          )}
          {seriesTitle ? `${seriesTitle}: ` : ""}
          <span className="text-slate-900 dark:text-white font-bold">
            {eventsAttended}/{totalEvents} Sessions Completed
          </span>
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            isCompleted
              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
              : "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
          }`}
        >
          {completionPercentage}%
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="relative h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700/60 shadow-inner">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isCompleted
              ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/20"
              : "bg-gradient-to-r from-purple-600 via-indigo-500 to-blue-500 shadow-md shadow-purple-500/20"
          }`}
          style={{ width: `${Math.min(100, completionPercentage)}%` }}
        />
      </div>

      {/* Segment step indicators for up to 10 sessions */}
      {totalEvents <= 12 && (
        <div className="flex items-center justify-between pt-1 px-0.5">
          {Array.from({ length: totalEvents }).map((_, idx) => {
            const isFilled = idx < eventsAttended;
            return (
              <div
                key={idx}
                title={`Session ${idx + 1}`}
                className="flex flex-col items-center gap-0.5 group cursor-default"
              >
                {isFilled ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                )}
                <span className="text-[9px] font-medium text-slate-400">W{idx + 1}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
