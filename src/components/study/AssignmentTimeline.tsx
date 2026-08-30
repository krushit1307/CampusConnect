import React, { useState } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Zap,
} from "lucide-react";
import differenceInCalendarDays from "date-fns/differenceInCalendarDays";
import format from "date-fns/format";
import type { Assignment, AssignmentStatus } from "@/hooks/useExamTracker";

interface AssignmentTimelineProps {
  assignments: Assignment[];
  onRemove: (id: string) => void;
  onUpdateStatus: (id: string, status: AssignmentStatus) => void;
  onUpdateGrade: (id: string, grade: number) => void;
  onUpdateHours: (id: string, hours: number) => void;
}

const STATUS_CONFIG: Record<
  AssignmentStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: <Clock className="w-3 h-3" />,
  },
  submitted: {
    label: "Submitted",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: <Send className="w-3 h-3" />,
  },
  graded: {
    label: "Graded",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  late: {
    label: "Late",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

function getDaysUntil(dueDate: string): number {
  return differenceInCalendarDays(new Date(dueDate), new Date());
}

function AssignmentRow({
  assignment,
  onRemove,
  onUpdateStatus,
  onUpdateGrade,
  onUpdateHours,
}: {
  assignment: Assignment;
  onRemove: (id: string) => void;
  onUpdateStatus: (id: string, status: AssignmentStatus) => void;
  onUpdateGrade: (id: string, grade: number) => void;
  onUpdateHours: (id: string, hours: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[assignment.status];
  const daysUntil = getDaysUntil(assignment.dueDate);
  const isOverdue = assignment.status === "pending" && daysUntil < 0;
  const isUrgent = assignment.status === "pending" && daysUntil >= 0 && daysUntil <= 2;
  const progressPct =
    assignment.estimatedHours > 0
      ? Math.min(100, Math.round((assignment.hoursSpent / assignment.estimatedHours) * 100))
      : 0;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isOverdue
          ? "bg-red-500/5 border-red-500/30"
          : isUrgent
            ? "bg-amber-500/5 border-amber-500/30"
            : "bg-slate-900/50 border-slate-800/60 hover:border-slate-700"
      }`}
    >
      {/* Main Row */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Course + Status */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                {assignment.courseCode}
              </span>
              <span
                className={`flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${status.bg} ${status.color} ${status.border}`}
              >
                {status.icon} {status.label}
              </span>
            </div>

            {/* Title */}
            <h4 className="text-sm font-bold text-slate-200 mb-1">{assignment.title}</h4>

            {/* Description */}
            <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">{assignment.description}</p>

            {/* Meta Row */}
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 flex-wrap">
              <span
                className={`flex items-center gap-1 ${isOverdue ? "text-red-400 font-bold" : isUrgent ? "text-amber-400 font-bold" : ""}`}
              >
                <Clock className="w-3 h-3" />
                {isOverdue
                  ? `${Math.abs(daysUntil)}d overdue`
                  : daysUntil === 0
                    ? "Due today"
                    : daysUntil === 1
                      ? "Due tomorrow"
                      : `Due in ${daysUntil} days`}
                {" • "}
                {format(
                  new Date(`${assignment.dueDate}T${assignment.dueTime}`),
                  "EEE, MMM d • HH:mm",
                )}
              </span>
              <span className="text-slate-600">|</span>
              <span>
                <FileText className="w-3 h-3 inline mr-0.5" />
                {assignment.weight}% of grade
              </span>
            </div>

            {/* Progress Bar */}
            {assignment.status !== "graded" && (
              <div className="mt-2 bg-slate-950/60 rounded-lg p-2 border border-slate-800/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-mono text-slate-500">Time Progress</span>
                  <span className="text-[9px] font-mono text-slate-400">
                    {assignment.hoursSpent.toFixed(1)} / {assignment.estimatedHours}h
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      progressPct >= 100
                        ? "bg-emerald-500"
                        : progressPct >= 60
                          ? "bg-cyan-500"
                          : "bg-amber-500"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Grade Display */}
            {assignment.status === "graded" && assignment.grade !== null && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-lg font-black font-mono text-emerald-400">
                  {assignment.grade}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  / {assignment.maxGrade}
                </span>
                <span className="text-[10px] font-mono text-slate-600">
                  ({Math.round((assignment.grade / assignment.maxGrade) * 100)}%)
                </span>
              </div>
            )}
          </div>

          {/* Actions Column */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-500 hover:text-slate-300 transition"
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Section */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800/40 pt-3 space-y-3">
          {/* Quick Status Updates */}
          {assignment.status !== "graded" && (
            <div>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
                Quick Actions
              </span>
              <div className="flex gap-1.5">
                {assignment.status === "pending" && (
                  <button
                    onClick={() => onUpdateStatus(assignment.id, "submitted")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition"
                  >
                    <Send className="w-3 h-3" /> Mark Submitted
                  </button>
                )}
                <button
                  onClick={() => onUpdateHours(assignment.id, assignment.hoursSpent + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:bg-cyan-500/15 hover:text-cyan-400 transition"
                >
                  <Zap className="w-3 h-3" /> +1h Study
                </button>
              </div>
            </div>
          )}

          {/* Grade Input (for submitted assignments) */}
          {assignment.status === "submitted" && (
            <div>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
                Enter Grade
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={assignment.maxGrade}
                  placeholder={`0-${assignment.maxGrade}`}
                  className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = Number((e.target as HTMLInputElement).value);
                      if (!isNaN(val)) onUpdateGrade(assignment.id, val);
                    }
                  }}
                />
                <span className="text-[10px] font-mono text-slate-500">
                  / {assignment.maxGrade}
                </span>
              </div>
            </div>
          )}

          {/* Remove button */}
          <button
            onClick={() => onRemove(assignment.id)}
            className="flex items-center gap-1 text-[10px] font-mono text-red-400/60 hover:text-red-400 transition"
          >
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

export default function AssignmentTimeline({
  assignments,
  onRemove,
  onUpdateStatus,
  onUpdateGrade,
  onUpdateHours,
}: AssignmentTimelineProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "submitted" | "graded" | "late">("all");

  const filtered = assignments
    .filter((a) => filter === "all" || a.status === filter)
    .sort((a, b) => {
      // Sort: late first, then pending by due date, then submitted, then graded
      const statusOrder = { late: 0, pending: 1, submitted: 2, graded: 3 };
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const counts = {
    all: assignments.length,
    pending: assignments.filter((a) => a.status === "pending").length,
    submitted: assignments.filter((a) => a.status === "submitted").length,
    graded: assignments.filter((a) => a.status === "graded").length,
    late: assignments.filter((a) => a.status === "late").length,
  };

  return (
    <div className="space-y-4">
      {/* Filter Pills */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", "pending", "submitted", "graded", "late"] as const).map((f) => {
          const cfg = f === "all" ? null : STATUS_CONFIG[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg border transition ${
                filter === f
                  ? cfg
                    ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                    : "bg-slate-700 border-slate-600 text-slate-200"
                  : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
            >
              {cfg?.icon}
              {f === "all" ? "All" : cfg?.label}
              <span className="opacity-60">({counts[f]})</span>
            </button>
          );
        })}
      </div>

      {/* Assignment List */}
      <div className="space-y-2">
        {filtered.length > 0 ? (
          filtered.map((assignment) => (
            <AssignmentRow
              key={assignment.id}
              assignment={assignment}
              onRemove={onRemove}
              onUpdateStatus={onUpdateStatus}
              onUpdateGrade={onUpdateGrade}
              onUpdateHours={onUpdateHours}
            />
          ))
        ) : (
          <div className="text-center py-8 bg-slate-900/30 rounded-xl border border-slate-800/40">
            <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500">
              No {filter !== "all" ? filter : ""} assignments
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
