import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle2,
  AlertTriangle,
  Calculator,
} from "lucide-react";
import type { CourseGrade } from "@/hooks/useExamTracker";

interface GradeCalculatorProps {
  courseGrades: CourseGrade[];
}

export default function GradeCalculator({ courseGrades }: GradeCalculatorProps) {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(
    courseGrades[0]?.courseCode || null,
  );

  const course = courseGrades.find((c) => c.courseCode === selectedCourse);

  const projectedGrade = useMemo(() => {
    if (!course) return 0;
    let totalWeight = 0;
    let earnedPoints = 0;

    course.assignments.forEach((a) => {
      earnedPoints += (a.grade / a.maxGrade) * a.weight;
      totalWeight += a.weight;
    });

    course.exams.forEach((e) => {
      if (e.grade !== null) {
        earnedPoints += (e.grade / 100) * e.weight;
        totalWeight += e.weight;
      }
    });

    return totalWeight > 0 ? Math.round((earnedPoints / totalWeight) * 1000) / 10 : 0;
  }, [course]);

  const neededForTarget = useMemo(() => {
    if (!course) return 0;
    let completedWeight = 0;
    let earnedPoints = 0;
    let remainingWeight = 0;

    course.assignments.forEach((a) => {
      earnedPoints += (a.grade / a.maxGrade) * a.weight;
      completedWeight += a.weight;
    });

    course.exams.forEach((e) => {
      if (e.grade !== null) {
        earnedPoints += (e.grade / 100) * e.weight;
        completedWeight += e.weight;
      } else {
        remainingWeight += e.weight;
      }
    });

    if (remainingWeight === 0) return 0;
    const needed = ((course.targetGrade - earnedPoints) / remainingWeight) * 100;
    return Math.max(0, Math.min(100, Math.round(needed)));
  }, [course]);

  const overallAverage = useMemo(() => {
    if (courseGrades.length === 0) return 0;
    return (
      Math.round(
        (courseGrades.reduce((s, c) => s + c.currentGrade, 0) / courseGrades.length) * 10,
      ) / 10
    );
  }, [courseGrades]);

  return (
    <div className="space-y-5">
      {/* Overall GPA Banner */}
      <div className="bg-gradient-to-r from-violet-900/40 to-indigo-900/30 border border-violet-500/20 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
              Overall Average
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-white">{overallAverage}%</span>
              <span className="text-xs font-mono text-slate-500">
                across {courseGrades.length} courses
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
              GPA Equivalent
            </span>
            <span className="text-2xl font-black font-mono text-violet-400">
              {(overallAverage / 25).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Course Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {courseGrades.map((c) => (
          <button
            key={c.courseCode}
            onClick={() => setSelectedCourse(c.courseCode)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold border transition whitespace-nowrap ${
              selectedCourse === c.courseCode
                ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span className="text-[10px]">{c.courseCode}</span>
            <span
              className={`text-sm font-black ${
                c.currentGrade >= c.targetGrade ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {c.currentGrade}%
            </span>
          </button>
        ))}
      </div>

      {/* Selected Course Detail */}
      {course && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-5">
          {/* Course Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-mono font-bold text-slate-200">
                {course.courseCode} — {course.courseName}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <span
                  className={`text-2xl font-black font-mono ${
                    projectedGrade >= course.targetGrade ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {projectedGrade}%
                </span>
                <span className="text-[10px] font-mono text-slate-500">projected</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                Target
              </span>
              <span className="text-lg font-black font-mono text-cyan-400">
                {course.targetGrade}%
              </span>
            </div>
          </div>

          {/* Projected vs Target */}
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                <Target className="w-3 h-3" /> Target Gap
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  projectedGrade >= course.targetGrade ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {projectedGrade >= course.targetGrade ? "+" : ""}
                {(projectedGrade - course.targetGrade).toFixed(1)}%
              </span>
            </div>
            <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  projectedGrade >= course.targetGrade ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, projectedGrade)}%` }}
              />
              {/* Target line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-cyan-400"
                style={{ left: `${course.targetGrade}%` }}
              />
            </div>
          </div>

          {/* Needed for target */}
          {neededForTarget > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">
                  Need on Remaining Work
                </span>
              </div>
              <p className="text-sm font-mono text-slate-300">
                You need <span className="font-black text-amber-300">{neededForTarget}%</span>{" "}
                average on remaining assessments to reach your {course.targetGrade}% target.
              </p>
            </div>
          )}

          {/* Assignments Table */}
          <div>
            <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">
              Assignments
            </h4>
            <div className="space-y-1.5">
              {course.assignments.map((a, i) => {
                const pct = Math.round((a.grade / a.maxGrade) * 100);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-slate-950/40 rounded-lg px-3 py-2 border border-slate-800/40"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-slate-300 font-medium truncate block">
                        {a.name}
                      </span>
                      <span className="text-[9px] font-mono text-slate-600">
                        Weight: {a.weight}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-sm font-mono font-bold ${
                          pct >= 90
                            ? "text-emerald-400"
                            : pct >= 80
                              ? "text-cyan-400"
                              : "text-amber-400"
                        }`}
                      >
                        {a.grade}/{a.maxGrade}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 w-8 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Exams Table */}
          <div>
            <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">
              Exams
            </h4>
            <div className="space-y-1.5">
              {course.exams.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-slate-950/40 rounded-lg px-3 py-2 border border-slate-800/40"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-slate-300 font-medium truncate block">
                      {e.name}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600">Weight: {e.weight}%</span>
                  </div>
                  <div className="shrink-0">
                    {e.grade !== null ? (
                      <span
                        className={`text-sm font-mono font-bold ${
                          e.grade >= 90
                            ? "text-emerald-400"
                            : e.grade >= 80
                              ? "text-cyan-400"
                              : "text-amber-400"
                        }`}
                      >
                        {e.grade}%
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-600 italic">upcoming</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
