import React, { useState } from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  GraduationCap,
  ListChecks,
  Target,
  Timer,
  TrendingUp,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import ExamCountdownCard from "./ExamCountdownCard";
import AssignmentTimeline from "./AssignmentTimeline";
import GradeCalculator from "./GradeCalculator";
import StudyPlanHeatmap from "./StudyPlanHeatmap";
import { useExamTracker } from "@/hooks/useExamTracker";

type ActiveTab = "exams" | "assignments" | "grades" | "study-plan";

export default function ExamTrackerDashboard() {
  const {
    exams,
    assignments,
    courseGrades,
    studyPlan,
    stats,
    removeExam,
    updateExamStudy,
    removeAssignment,
    updateAssignmentStatus,
    updateAssignmentGrade,
    updateAssignmentHours,
  } = useExamTracker();

  const [activeTab, setActiveTab] = useState<ActiveTab>("exams");

  const sortedExams = [...exams].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-rose-900/50 via-orange-900/40 to-slate-900 border border-orange-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-10 bottom-0 w-40 h-40 bg-rose-500/8 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-orange-500/20 text-orange-300 text-xs px-3 py-1 rounded-full font-semibold border border-orange-500/30 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" /> Exam Tracker
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" /> 4 courses tracked
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-orange-200 bg-clip-text text-transparent">
              Exam Countdown & Grade Tracker
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Never miss a deadline. Track exam countdowns, manage assignments, calculate grades,
              and plan your study schedule.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            {[
              {
                key: "exams" as const,
                label: "Exam Countdown",
                icon: <Timer className="w-4 h-4" />,
              },
              {
                key: "assignments" as const,
                label: "Assignments",
                icon: <ListChecks className="w-4 h-4" />,
              },
              {
                key: "grades" as const,
                label: "Grade Calculator",
                icon: <BarChart3 className="w-4 h-4" />,
              },
              {
                key: "study-plan" as const,
                label: "Study Plan",
                icon: <Calendar className="w-4 h-4" />,
              },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                  activeTab === key
                    ? "bg-orange-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            icon={<Timer className="w-5 h-5" />}
            label="Next Exam"
            value={stats.daysUntilNextExam.toString()}
            unit="days"
            color="text-orange-400"
            bgColor="bg-orange-500/10"
            borderColor="border-orange-500/30"
          />
          <KPICard
            icon={<ListChecks className="w-5 h-5" />}
            label="Pending Tasks"
            value={stats.pendingAssignments.toString()}
            unit="assignments"
            color="text-amber-400"
            bgColor="bg-amber-500/10"
            borderColor="border-amber-500/30"
          />
          <KPICard
            icon={<Target className="w-5 h-5" />}
            label="Average Grade"
            value={`${stats.averageGrade}`}
            unit="%"
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
            borderColor="border-emerald-500/30"
          />
          <KPICard
            icon={<Flame className="w-5 h-5" />}
            label="Study Hours"
            value={stats.totalStudyHours.toString()}
            unit="logged"
            color="text-cyan-400"
            bgColor="bg-cyan-500/10"
            borderColor="border-cyan-500/30"
          />
        </div>

        {/* Urgency Banner */}
        {stats.overdueAssignments > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <span className="text-xs font-mono font-bold text-red-300">
                {stats.overdueAssignments} overdue assignment
                {stats.overdueAssignments !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-red-400/60 ml-2">
                Submit as soon as possible to avoid further grade penalties.
              </span>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "exams" && (
          <div className="space-y-4">
            {stats.nextExamTitle !== "No upcoming exams" && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/30">
                  <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                    Next Up
                  </span>
                  <h3 className="text-sm font-bold text-slate-200">
                    {stats.nextExamTitle} — in {stats.daysUntilNextExam} days
                  </h3>
                </div>
                <span className="text-2xl font-black font-mono text-orange-400">
                  {stats.daysUntilNextExam}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedExams.map((exam) => (
                <ExamCountdownCard
                  key={exam.id}
                  exam={exam}
                  onRemove={removeExam}
                  onUpdateStudy={updateExamStudy}
                />
              ))}
            </div>

            {exams.length === 0 && (
              <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <Timer className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-400">No upcoming exams</h3>
                <p className="text-slate-600 text-sm mt-1">
                  Enjoy the break! Add exams to start tracking.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "assignments" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <ListChecks className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                Assignment Tracker
              </h2>
            </div>
            <AssignmentTimeline
              assignments={assignments}
              onRemove={removeAssignment}
              onUpdateStatus={updateAssignmentStatus}
              onUpdateGrade={updateAssignmentGrade}
              onUpdateHours={updateAssignmentHours}
            />
          </div>
        )}

        {activeTab === "grades" && (
          <div>
            <GradeCalculator courseGrades={courseGrades} />
          </div>
        )}

        {activeTab === "study-plan" && <StudyPlanHeatmap studyPlan={studyPlan} />}
      </main>
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  unit,
  color,
  bgColor,
  borderColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-2xl p-4 transition-all hover:scale-[1.02] duration-200`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-black font-mono ${color}`}>{value}</span>
        <span className="text-[10px] font-mono text-slate-500">{unit}</span>
      </div>
    </div>
  );
}
