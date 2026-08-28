import React from 'react';
import { SemesterPlan, Course } from '@/types/degreePlanner';
import { Plus, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface SemesterColumnProps {
  semester: SemesterPlan;
  completedCourseCodes: Set<string>;
  onAddCourseClick: (semesterId: string) => void;
  onRemoveCourse: (semesterId: string, courseId: string) => void;
  onToggleComplete: (semesterId: string, courseId: string) => void;
}

export function SemesterColumn({
  semester,
  completedCourseCodes,
  onAddCourseClick,
  onRemoveCourse,
  onToggleComplete,
}: SemesterColumnProps) {
  const currentCredits = semester.courses.reduce((sum, c) => sum + c.credits, 0);
  const isOverloaded = currentCredits > semester.maxCredits;

  const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
    core: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
    math: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
    systems: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
    theory: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
    ai: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-300' },
    elective: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300' },
  };

  return (
    <div className="flex flex-col bg-white border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-w-[280px] w-full">
      {/* Semester Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
        <div>
          <h3 className="font-display font-black text-lg text-black">
            {semester.term} {semester.year}
          </h3>
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span
              className={`font-bold ${
                isOverloaded ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              {currentCredits} / {semester.maxCredits} Credits
            </span>
            {isOverloaded && (
              <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1 rounded border border-red-300">
                Overload
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => onAddCourseClick(semester.id)}
          className="p-1.5 bg-lime hover:bg-lime/90 border-2 border-black rounded transition-transform active:scale-95"
          title="Add Course"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Course Cards List */}
      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[480px] pr-1">
        {semester.courses.length === 0 ? (
          <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded font-mono text-xs text-gray-400">
            No courses planned yet. Click + to add.
          </div>
        ) : (
          semester.courses.map((course) => {
            const hasMissingPrereq = course.prerequisites.some(
              (p) => !completedCourseCodes.has(p)
            );
            const style = categoryColors[course.category] || categoryColors.elective;

            return (
              <div
                key={course.id}
                className={`p-3 border-2 border-black rounded-md transition-all ${
                  course.completed
                    ? 'bg-emerald-50/80 border-emerald-800'
                    : style.bg
                } ${hasMissingPrereq && !course.completed ? 'ring-2 ring-red-400' : ''}`}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-black text-sm text-black">
                      {course.code}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 bg-white border border-black rounded-full font-bold">
                      {course.credits}cr
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleComplete(semester.id, course.id)}
                      className={`p-1 rounded transition-colors ${
                        course.completed
                          ? 'text-emerald-700 bg-emerald-100'
                          : 'text-gray-400 hover:text-emerald-600'
                      }`}
                      title={course.completed ? 'Mark Incomplete' : 'Mark Completed'}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button
                      onClick={() => onRemoveCourse(semester.id, course.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                      title="Remove Course"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="font-mono text-xs text-gray-800 font-semibold line-clamp-1 mb-1">
                  {course.title}
                </div>

                {/* Prerequisite Warnings */}
                {hasMissingPrereq && !course.completed && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-mono font-bold text-red-600 bg-red-50 p-1 rounded border border-red-200">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>Req: {course.prerequisites.join(', ')}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
