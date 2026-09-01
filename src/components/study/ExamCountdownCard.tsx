import React, { useState } from "react";
import {
  Clock,
  MapPin,
  BookOpen,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Timer,
  CheckCircle2,
  Flame,
} from "lucide-react";
import differenceInCalendarDays from "date-fns/differenceInCalendarDays";
import differenceInHours from "date-fns/differenceInHours";
import differenceInMinutes from "date-fns/differenceInMinutes";
import format from "date-fns/format";
import type { Exam } from "@/hooks/useExamTracker";

interface ExamCountdownCardProps {
  exam: Exam;
  onRemove: (id: string) => void;
  onUpdateStudy: (id: string, hours: number) => void;
}

function getTimeRemaining(
  dateStr: string,
  startTime: string,
): {
  days: number;
  hours: number;
  minutes: number;
  totalMinutes: number;
} {
  const now = new Date();
  const examDate = new Date(`${dateStr}T${startTime}:00`);
  const diffMs = examDate.getTime() - now.getTime();
  if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, totalMinutes: 0 };
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes, totalMinutes };
}

function getUrgencyLevel(totalMinutes: number): {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  pulse: boolean;
} {
  if (totalMinutes < 60)
    return {
      color: "text-red-400",
      bgColor: "bg-red-500/15",
      borderColor: "border-red-500/40",
      label: "CRITICAL",
      pulse: true,
    };
  if (totalMinutes < 360)
    return {
      color: "text-orange-400",
      bgColor: "bg-orange-500/15",
      borderColor: "border-orange-500/40",
      label: "URGENT",
      pulse: true,
    };
  if (totalMinutes < 1440)
    return {
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      label: "SOON",
      pulse: false,
    };
  if (totalMinutes < 4320)
    return {
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30",
      label: "UPCOMING",
      pulse: false,
    };
  return {
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/20",
    label: "PLANNED",
    pulse: false,
  };
}

const EXAM_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  midterm: { bg: "bg-violet-500/15", text: "text-violet-300", border: "border-violet-500/30" },
  final: { bg: "bg-red-500/15", text: "text-red-300", border: "border-red-500/30" },
  quiz: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30" },
  practical: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30" },
};

export default function ExamCountdownCard({
  exam,
  onRemove,
  onUpdateStudy,
}: ExamCountdownCardProps) {
  const [expanded, setExpanded] = useState(false);
  const time = getTimeRemaining(exam.date, exam.startTime);
  const urgency = getUrgencyLevel(time.totalMinutes);
  const typeColor = EXAM_TYPE_COLORS[exam.examType] || EXAM_TYPE_COLORS.midterm;
  const studyPct = Math.min(
    100,
    Math.round((exam.studyHoursCompleted / exam.studyHoursTarget) * 100),
  );

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 ${urgency.bgColor} ${urgency.borderColor} ${
        urgency.pulse ? "animate-pulse" : ""
      }`}
    >
      {/* Main Card */}
      <div className="p-5">
        {/* Top Row: Type Badge + Urgency + Time */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}
            >
              {exam.examType.toUpperCase()}
            </span>
            <span className={`text-[10px] font-mono font-bold ${urgency.color}`}>
              {urgency.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {urgency.pulse && <Flame className="w-3 h-3 text-red-400 animate-pulse" />}
            <span className={`text-xs font-mono font-bold ${urgency.color}`}>
              {time.days > 0 && `${time.days}d `}
              {time.hours}h {time.minutes}m
            </span>
          </div>
        </div>

        {/* Course + Title */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
            {exam.courseCode}
          </span>
          <span className="text-[10px] text-slate-500">{exam.courseName}</span>
        </div>
        <h3 className="text-base font-bold text-slate-100 mb-2">{exam.title}</h3>

        {/* Date + Time + Location */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 mb-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(`${exam.date}T${exam.startTime}`), "EEE, MMM d")} • {exam.startTime}–
            {exam.endTime}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {exam.location}
          </span>
        </div>

        {/* Study Progress Bar */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Study Progress
            </span>
            <span className="text-xs font-mono font-bold text-slate-300">
              {exam.studyHoursCompleted} / {exam.studyHoursTarget}h
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                studyPct >= 100
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  : studyPct >= 60
                    ? "bg-gradient-to-r from-cyan-500 to-emerald-400"
                    : studyPct >= 30
                      ? "bg-gradient-to-r from-cyan-600 to-cyan-400"
                      : "bg-gradient-to-r from-amber-600 to-amber-400"
              }`}
              style={{ width: `${studyPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] font-mono text-slate-600">{studyPct}% complete</span>
            <span className="text-[9px] font-mono text-slate-600">
              {exam.weight}% of final grade
            </span>
          </div>
        </div>

        {/* Weight + Expand */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500">Grade Weight:</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-1.5 rounded-sm ${
                    i < Math.ceil(exam.weight / 10) ? "bg-cyan-500/60" : "bg-slate-800"
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400">{exam.weight}%</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Less" : "Details"}
          </button>
        </div>
      </div>

      {/* Expanded Section */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-800/40 pt-4 space-y-4">
          {/* Syllabus Topics */}
          <div>
            <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">
              Syllabus Topics
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {exam.syllabusTopics.map((topic, i) => {
                const isStudied =
                  i <
                  Math.floor(
                    (exam.studyHoursCompleted / exam.studyHoursTarget) * exam.syllabusTopics.length,
                  );
                return (
                  <span
                    key={i}
                    className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition ${
                      isStudied
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    {isStudied && <CheckCircle2 className="w-2.5 h-2.5 inline mr-1" />}
                    {topic}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Study Hours Adjuster */}
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2">
              Log Study Hours
            </span>
            <div className="flex items-center gap-2">
              {[0.5, 1, 2, 3, 5].map((hrs) => (
                <button
                  key={hrs}
                  onClick={() =>
                    onUpdateStudy(
                      exam.id,
                      Math.min(exam.studyHoursTarget, exam.studyHoursCompleted + hrs),
                    )
                  }
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-slate-400 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/30 transition"
                >
                  +{hrs}h
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          {exam.notes && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold flex items-center gap-1 mb-1">
                <AlertTriangle className="w-3 h-3" /> Study Notes
              </span>
              <p className="text-xs text-slate-400">{exam.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onRemove(exam.id)}
              className="text-[10px] font-mono text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition"
            >
              Remove Exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
