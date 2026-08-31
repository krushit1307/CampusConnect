import React from "react";
import { Calendar, BookOpen, Clock, FileText, Target, Flame } from "lucide-react";
import format from "date-fns/format";
import parseISO from "date-fns/parseISO";
import type { StudyPlanDay } from "@/hooks/useExamTracker";

interface StudyPlanHeatmapProps {
  studyPlan: StudyPlanDay[];
}

function getIntensityClass(hours: number): string {
  if (hours <= 0) return "bg-slate-800/30 border-slate-800/40";
  if (hours < 1) return "bg-amber-500/10 border-amber-500/20";
  if (hours < 2) return "bg-amber-500/20 border-amber-500/30";
  if (hours < 3) return "bg-orange-500/25 border-orange-500/35";
  return "bg-red-500/25 border-red-500/40";
}

function getIntensityText(hours: number): string {
  if (hours <= 0) return "text-slate-600";
  if (hours < 1) return "text-amber-300";
  if (hours < 2) return "text-amber-200";
  if (hours < 3) return "text-orange-300";
  return "text-red-300";
}

export default function StudyPlanHeatmap({ studyPlan }: StudyPlanHeatmapProps) {
  const today = new Date();
  const totalHours = studyPlan.reduce((s, d) => s + d.totalHours, 0);
  const totalExamPrep = studyPlan.filter((d) => d.examsPreparing.length > 0).length;
  const totalAssignmentDue = studyPlan.reduce((s, d) => s + d.assignmentsDue.length, 0);

  return (
    <div className="space-y-5">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center">
          <Clock className="w-5 h-5 text-orange-400 mx-auto mb-2" />
          <span className="text-xl font-black font-mono text-white block">
            {totalHours.toFixed(1)}h
          </span>
          <span className="text-[10px] font-mono text-slate-500">Total Study</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center">
          <Flame className="w-5 h-5 text-red-400 mx-auto mb-2" />
          <span className="text-xl font-black font-mono text-white block">{totalExamPrep}</span>
          <span className="text-[10px] font-mono text-slate-500">Exam Days</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center">
          <FileText className="w-5 h-5 text-amber-400 mx-auto mb-2" />
          <span className="text-xl font-black font-mono text-white block">
            {totalAssignmentDue}
          </span>
          <span className="text-[10px] font-mono text-slate-500">Deadlines</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Calendar className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
            14-Day Study Plan
          </h2>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {studyPlan.map((day, i) => {
            const date = parseISO(day.date);
            const isToday = format(today, "yyyy-MM-dd") === day.date;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const hasExams = day.examsPreparing.length > 0;
            const hasDeadlines = day.assignmentsDue.length > 0;

            return (
              <div
                key={day.date}
                className={`rounded-xl border p-3 transition-all hover:scale-105 ${getIntensityClass(day.totalHours)} ${
                  isToday ? "ring-2 ring-orange-400/50" : ""
                }`}
              >
                {/* Day Header */}
                <div className="text-center mb-2">
                  <span
                    className={`text-[9px] font-mono uppercase ${isWeekend ? "text-slate-600" : "text-slate-500"}`}
                  >
                    {format(date, "EEE")}
                  </span>
                  <div
                    className={`text-sm font-mono font-bold ${
                      isToday ? "text-orange-400" : "text-slate-300"
                    }`}
                  >
                    {format(date, "d")}
                  </div>
                </div>

                {/* Hours */}
                <div className={`text-center mb-2 ${getIntensityText(day.totalHours)}`}>
                  <span className="text-lg font-black font-mono">
                    {day.totalHours > 0 ? day.totalHours.toFixed(1) : "—"}
                  </span>
                  <span className="text-[8px] font-mono block opacity-60">hrs</span>
                </div>

                {/* Indicators */}
                <div className="space-y-1">
                  {hasExams && (
                    <div className="flex items-center gap-1 bg-red-500/20 rounded-md px-1.5 py-0.5">
                      <Flame className="w-2 h-2 text-red-400" />
                      <span className="text-[8px] font-mono text-red-300 truncate">
                        {day.examsPreparing.length} exam
                      </span>
                    </div>
                  )}
                  {hasDeadlines && (
                    <div className="flex items-center gap-1 bg-amber-500/20 rounded-md px-1.5 py-0.5">
                      <FileText className="w-2 h-2 text-amber-400" />
                      <span className="text-[8px] font-mono text-amber-300 truncate">
                        {day.assignmentsDue.length} due
                      </span>
                    </div>
                  )}
                  {day.coursesToStudy.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {day.coursesToStudy.slice(0, 3).map((code) => (
                        <span
                          key={code}
                          className="text-[7px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1 rounded"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Daily Breakdown */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider mb-4">
          Daily Breakdown
        </h3>
        <div className="space-y-2">
          {studyPlan
            .filter(
              (d) => d.totalHours > 0 || d.examsPreparing.length > 0 || d.assignmentsDue.length > 0,
            )
            .map((day) => {
              const date = parseISO(day.date);
              const isToday = format(today, "yyyy-MM-dd") === day.date;
              return (
                <div
                  key={day.date}
                  className={`flex items-center gap-4 p-3 rounded-xl border transition ${
                    isToday
                      ? "bg-orange-500/5 border-orange-500/30"
                      : "bg-slate-950/40 border-slate-800/40"
                  }`}
                >
                  {/* Date */}
                  <div className="w-16 text-center shrink-0">
                    <span
                      className={`text-[10px] font-mono ${isToday ? "text-orange-400 font-bold" : "text-slate-500"}`}
                    >
                      {format(date, "EEE")}
                    </span>
                    <div
                      className={`text-sm font-mono font-bold ${isToday ? "text-orange-400" : "text-slate-300"}`}
                    >
                      {format(date, "MMM d")}
                    </div>
                  </div>

                  {/* Hours Bar */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span
                        className={`text-xs font-mono font-bold ${getIntensityText(day.totalHours)}`}
                      >
                        {day.totalHours > 0 ? `${day.totalHours}h study` : "Rest day"}
                      </span>
                    </div>
                    {day.totalHours > 0 && (
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-red-400 rounded-full"
                          style={{ width: `${Math.min(100, (day.totalHours / 4) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Events */}
                  <div className="flex items-center gap-2 shrink-0">
                    {day.examsPreparing.length > 0 && (
                      <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-red-300 bg-red-500/15 border border-red-500/30 px-2 py-1 rounded-lg">
                        <Flame className="w-2.5 h-2.5" /> Exam
                      </span>
                    )}
                    {day.assignmentsDue.length > 0 && (
                      <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-1 rounded-lg">
                        <FileText className="w-2.5 h-2.5" /> {day.assignmentsDue.length} Due
                      </span>
                    )}
                    {day.coursesToStudy.map((code) => (
                      <span
                        key={code}
                        className="text-[8px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
