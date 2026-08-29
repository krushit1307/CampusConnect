import React from 'react';
import { Course } from '@/types/degreePlanner';
import { Lock, Check, Sparkles, Zap } from 'lucide-react';

interface SkillTreeVisualizerProps {
  courses: Course[];
  completedCourseCodes: Set<string>;
  onSelectCourse?: (course: Course) => void;
}

export function SkillTreeVisualizer({
  courses,
  completedCourseCodes,
  onSelectCourse,
}: SkillTreeVisualizerProps) {
  // Organize courses by levels: 100s, 200s, 300s, 400s
  const levelGroups = {
    intro: { title: 'Tier 1: Foundations', courses: courses.filter((c) => c.level === 'intro') },
    intermediate: { title: 'Tier 2: Core Systems & Math', courses: courses.filter((c) => c.level === 'intermediate') },
    advanced: { title: 'Tier 3: Advanced Specializations', courses: courses.filter((c) => c.level === 'advanced') },
    capstone: { title: 'Tier 4: Capstone & Mastery', courses: courses.filter((c) => c.level === 'capstone') },
  };

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
        <div>
          <h2 className="text-xl font-display font-black text-black flex items-center gap-2">
            <Sparkles className="text-amber-500" size={20} /> Academic Skill Tree
          </h2>
          <p className="font-mono text-xs text-gray-600">
            Visual progression of unlocked tracks and prerequisite pathways.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-emerald-400 border border-black rounded-full" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-lime border border-black rounded-full" />
            <span>Unlocked</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-slate-200 border border-black rounded-full" />
            <span>Locked</span>
          </div>
        </div>
      </div>

      {/* Skill Tree Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Object.entries(levelGroups).map(([key, group], idx) => (
          <div key={key} className="space-y-4">
            <div className="bg-black text-white px-3 py-1.5 rounded font-mono text-xs font-bold text-center">
              {group.title}
            </div>

            <div className="space-y-3">
              {group.courses.map((course) => {
                const isCompleted = completedCourseCodes.has(course.code);
                const isUnlocked = course.prerequisites.every((p) => completedCourseCodes.has(p));

                return (
                  <div
                    key={course.id}
                    onClick={() => onSelectCourse?.(course)}
                    className={`p-3.5 border-2 border-black rounded-lg cursor-pointer transition-all duration-200 hover:-translate-y-1 ${
                      isCompleted
                        ? 'bg-emerald-100 border-emerald-900 shadow-[2px_2px_0px_0px_rgba(6,78,59,1)]'
                        : isUnlocked
                        ? 'bg-lime hover:bg-lime/90 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-slate-100 text-gray-400 border-gray-300 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-display font-black text-sm text-black">
                        {course.code}
                      </span>
                      {isCompleted ? (
                        <Check size={16} className="text-emerald-800" />
                      ) : isUnlocked ? (
                        <Zap size={14} className="text-amber-700" />
                      ) : (
                        <Lock size={14} className="text-gray-400" />
                      )}
                    </div>

                    <div className="font-mono text-xs font-bold text-black line-clamp-1">
                      {course.title}
                    </div>

                    {course.prerequisites.length > 0 && (
                      <div className="mt-2 pt-1 border-t border-black/10 font-mono text-[10px] text-gray-600">
                        Prereq: {course.prerequisites.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
