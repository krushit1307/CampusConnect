import React, { useState, useMemo } from 'react';
import { SiteShell } from '@/components/site/SiteShell';
import { SemesterColumn } from '@/components/planner/SemesterColumn';
import { SkillTreeVisualizer } from '@/components/planner/SkillTreeVisualizer';
import { AddCourseModal } from '@/components/planner/AddCourseModal';
import { Course, SemesterPlan, DegreeRequirementGroup } from '@/types/degreePlanner';
import {
  GraduationCap,
  Sparkles,
  LayoutGrid,
  GitFork,
  BookMarked,
  Trophy,
  CheckCircle,
} from 'lucide-react';

export default function DegreePlannerPage() {
  const [activeView, setActiveView] = useState<'schedule' | 'skillTree'>('schedule');
  const [selectedSemesterForAdd, setSelectedSemesterForAdd] = useState<string | null>(null);

  // Master Course Catalog
  const [courseCatalog] = useState<Course[]>([
    { id: 'c-1', code: 'CS 101', title: 'Intro to Computer Science', credits: 4, category: 'core', level: 'intro', description: 'Basics of programming in Python and OOP principles.', prerequisites: [] },
    { id: 'c-2', code: 'MATH 151', title: 'Calculus I for Engineers', credits: 4, category: 'math', level: 'intro', description: 'Differential and integral calculus.', prerequisites: [] },
    { id: 'c-3', code: 'CS 201', title: 'Data Structures & Algorithms', credits: 4, category: 'core', level: 'intermediate', description: 'Arrays, linked lists, trees, graphs, and Big-O runtime analysis.', prerequisites: ['CS 101'] },
    { id: 'c-4', code: 'MATH 250', title: 'Discrete Mathematics', credits: 3, category: 'math', level: 'intro', description: 'Logic, sets, proofs, relations, and combinatorics.', prerequisites: ['MATH 151'] },
    { id: 'c-5', code: 'CS 250', title: 'Computer Architecture & Assembly', credits: 4, category: 'systems', level: 'intermediate', description: 'Digital logic, instruction set architectures, and memory hierarchies.', prerequisites: ['CS 101'] },
    { id: 'c-6', code: 'CS 310', title: 'Operating Systems & Concurrency', credits: 4, category: 'systems', level: 'advanced', description: 'Processes, threads, virtualization, and file systems.', prerequisites: ['CS 201', 'CS 250'] },
    { id: 'c-7', code: 'CS 340', title: 'Database Management Systems', credits: 3, category: 'systems', level: 'advanced', description: 'Relational algebra, SQL, indexing, and transaction isolation.', prerequisites: ['CS 201'] },
    { id: 'c-8', code: 'CS 360', title: 'Theory of Computation', credits: 3, category: 'theory', level: 'advanced', description: 'Automata, grammars, Turing machines, and NP-completeness.', prerequisites: ['CS 201', 'MATH 250'] },
    { id: 'c-9', code: 'CS 480', title: 'Artificial Intelligence & ML', credits: 4, category: 'ai', level: 'advanced', description: 'Neural networks, supervised learning, search, and probabilistic models.', prerequisites: ['CS 201', 'MATH 151'] },
    { id: 'c-10', code: 'CS 499', title: 'Senior Capstone Design Project', credits: 4, category: 'core', level: 'capstone', description: 'Team-based industry capstone design and development.', prerequisites: ['CS 310', 'CS 340'] },
  ]);

  // Initial Semester Plans
  const [semesters, setSemesters] = useState<SemesterPlan[]>([
    {
      id: 'sem-1',
      term: 'Fall',
      year: 2024,
      maxCredits: 18,
      courses: [
        { ...courseCatalog[0], completed: true },
        { ...courseCatalog[1], completed: true },
      ],
    },
    {
      id: 'sem-2',
      term: 'Spring',
      year: 2025,
      maxCredits: 18,
      courses: [
        { ...courseCatalog[2], completed: true },
        { ...courseCatalog[3], completed: true },
      ],
    },
    {
      id: 'sem-3',
      term: 'Fall',
      year: 2025,
      maxCredits: 18,
      courses: [
        { ...courseCatalog[4], completed: false },
        { ...courseCatalog[6], completed: false },
      ],
    },
    {
      id: 'sem-4',
      term: 'Spring',
      year: 2026,
      maxCredits: 18,
      courses: [
        { ...courseCatalog[5], completed: false },
        { ...courseCatalog[7], completed: false },
      ],
    },
  ]);

  // Completed course codes set
  const completedCourseCodes = useMemo(() => {
    const set = new Set<string>();
    semesters.forEach((sem) => {
      sem.courses.forEach((c) => {
        if (c.completed) set.add(c.code);
      });
    });
    return set;
  }, [semesters]);

  // Total completed credits
  const totalCompletedCredits = useMemo(() => {
    let total = 0;
    semesters.forEach((sem) => {
      sem.courses.forEach((c) => {
        if (c.completed) total += c.credits;
      });
    });
    return total;
  }, [semesters]);

  const totalRequiredCredits = 120;
  const progressPercent = Math.min(100, Math.round((totalCompletedCredits / totalRequiredCredits) * 100));

  const handleAddCourse = (semesterId: string, course: Course) => {
    setSemesters((prev) =>
      prev.map((sem) => {
        if (sem.id === semesterId) {
          return {
            ...sem,
            courses: [...sem.courses, { ...course, completed: false }],
          };
        }
        return sem;
      })
    );
  };

  const handleRemoveCourse = (semesterId: string, courseId: string) => {
    setSemesters((prev) =>
      prev.map((sem) => {
        if (sem.id === semesterId) {
          return {
            ...sem,
            courses: sem.courses.filter((c) => c.id !== courseId),
          };
        }
        return sem;
      })
    );
  };

  const handleToggleComplete = (semesterId: string, courseId: string) => {
    setSemesters((prev) =>
      prev.map((sem) => {
        if (sem.id === semesterId) {
          return {
            ...sem,
            courses: sem.courses.map((c) =>
              c.id === courseId ? { ...c, completed: !c.completed } : c
            ),
          };
        }
        return sem;
      })
    );
  };

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header & Stats Banner */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-black pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-lime border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <GraduationCap size={24} />
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black">
                  Degree Path Planner
                </h1>
              </div>
              <p className="font-mono text-sm text-gray-600 mt-1">
                B.S. Computer Science • Drag & drop term scheduling with real-time prerequisite DAG validation.
              </p>
            </div>

            {/* View Switcher */}
            <div className="neu-border bg-white p-1.5 flex items-center gap-2">
              <button
                onClick={() => setActiveView('schedule')}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeView === 'schedule'
                    ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <LayoutGrid size={16} /> Semester Grid
              </button>
              <button
                onClick={() => setActiveView('skillTree')}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeView === 'skillTree'
                    ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <GitFork size={16} /> Skill Tree
              </button>
            </div>
          </div>

          {/* Gamified Degree Progress Card */}
          <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-amber-300 border-2 border-black rounded-full flex items-center justify-center font-display font-black text-xl shadow-xs">
                <Trophy size={26} className="text-black" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-black">
                  Degree Completion Tracker
                </h3>
                <p className="font-mono text-xs text-gray-600">
                  {totalCompletedCredits} of {totalRequiredCredits} credits completed ({progressPercent}%)
                </p>
              </div>
            </div>

            <div className="w-full md:w-1/2 flex flex-col gap-2">
              <div className="w-full h-5 bg-slate-100 border-2 border-black rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-lime border-r-2 border-black transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between font-mono text-[10px] text-gray-500 font-bold">
                <span>Freshman</span>
                <span>Sophomore</span>
                <span>Junior</span>
                <span>Senior Capstone</span>
              </div>
            </div>
          </div>

          {/* Dynamic Content Views */}
          {activeView === 'schedule' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {semesters.map((semester) => (
                <SemesterColumn
                  key={semester.id}
                  semester={semester}
                  completedCourseCodes={completedCourseCodes}
                  onAddCourseClick={(semId) => setSelectedSemesterForAdd(semId)}
                  onRemoveCourse={handleRemoveCourse}
                  onToggleComplete={handleToggleComplete}
                />
              ))}
            </div>
          ) : (
            <SkillTreeVisualizer
              courses={courseCatalog}
              completedCourseCodes={completedCourseCodes}
            />
          )}
        </div>
      </div>

      {/* Add Course Modal */}
      <AddCourseModal
        isOpen={!!selectedSemesterForAdd}
        semesterId={selectedSemesterForAdd}
        onClose={() => setSelectedSemesterForAdd(null)}
        onAddCourse={handleAddCourse}
        availableCourses={courseCatalog}
      />
    </SiteShell>
  );
}
