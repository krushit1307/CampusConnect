import { useState } from "react";
import {
  GraduationCap,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Award,
  BookOpen,
  TrendingUp,
  Target,
  BarChart3,
  RotateCcw,
} from "lucide-react";
import {
  useGradeCalculator,
  type GradeType,
  LETTER_GRADES,
} from "../../hooks/useGradeCalculator";

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-400",
  A: "text-emerald-400",
  "A-": "text-emerald-300",
  "B+": "text-cyan-400",
  B: "text-cyan-400",
  "B-": "text-cyan-300",
  "C+": "text-amber-400",
  C: "text-amber-400",
  "C-": "text-amber-300",
  "D+": "text-orange-400",
  D: "text-orange-400",
  "D-": "text-orange-300",
  F: "text-red-400",
};

const BAR_COLORS: Record<string, string> = {
  "A+": "bg-emerald-400",
  A: "bg-emerald-400",
  "A-": "bg-emerald-300",
  "B+": "bg-cyan-400",
  B: "bg-cyan-400",
  "B-": "bg-cyan-300",
  "C+": "bg-amber-400",
  C: "bg-amber-400",
  "C-": "bg-amber-300",
  "D+": "bg-orange-400",
  D: "bg-orange-400",
  "D-": "bg-orange-300",
  F: "bg-red-400",
};

function formatGPA(gpa: number): string {
  return gpa.toFixed(2);
}

function getGPALetter(gpa: number): string {
  if (gpa >= 3.85) return "A";
  if (gpa >= 3.5) return "A-";
  if (gpa >= 3.15) return "B+";
  if (gpa >= 2.85) return "B";
  if (gpa >= 2.5) return "B-";
  if (gpa >= 2.15) return "C+";
  if (gpa >= 1.85) return "C";
  if (gpa >= 1.5) return "C-";
  if (gpa >= 1.15) return "D+";
  if (gpa >= 0.85) return "D";
  return "F";
}

interface AddCourseModalProps {
  onAdd: (
    name: string,
    credits: number,
    gradeType: GradeType,
    grade: string,
    semester: string,
  ) => void;
  onClose: () => void;
}

function AddCourseModal({ onAdd, onClose }: AddCourseModalProps) {
  const [name, setName] = useState("");
  const [credits, setCredits] = useState(3);
  const [gradeType, setGradeType] = useState<GradeType>("letter");
  const [grade, setGrade] = useState("A");
  const [semester, setSemester] = useState(() => {
    const now = new Date();
    const season = now.getMonth() < 6 ? "Spring" : "Fall";
    return `${season} ${now.getFullYear()}`;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim(), credits, gradeType, grade, semester);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-bold text-slate-100">Add Course</h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {/* Course Name */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">
              Course Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Introduction to Psychology"
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Credits + Semester */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">
                Credits
              </label>
              <input
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">
                Semester
              </label>
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="Fall 2025"
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Grade Type */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">
              Grade Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "letter" as GradeType, label: "Letter" },
                { value: "percentage" as GradeType, label: "Percentage" },
                { value: "gpa4" as GradeType, label: "4.0 Scale" },
              ]).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setGradeType(value);
                    setGrade(value === "letter" ? "A" : value === "percentage" ? "85" : "3.5");
                  }}
                  className={`text-xs font-mono rounded-xl py-2 border transition-all ${
                    gradeType === value
                      ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                      : "bg-slate-800 border-slate-600 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Grade Input */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">
              Grade
            </label>
            {gradeType === "letter" ? (
              <div className="grid grid-cols-7 gap-1">
                {LETTER_GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={`text-[10px] font-mono rounded-lg py-1.5 border transition-all ${
                      grade === g
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="number"
                min={0}
                max={gradeType === "percentage" ? 100 : 4.0}
                step={gradeType === "percentage" ? 1 : 0.1}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-xs text-slate-500 hover:text-slate-300 py-2.5 rounded-xl border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-xs rounded-xl py-2.5 transition-colors"
          >
            Add Course
          </button>
        </div>
      </form>
    </div>
  );
}

interface TargetGPAPanelProps {
  currentGPA: number;
  currentCredits: number;
  onCalculate: (currentGPA: number, currentCredits: number, targetGPA: number) => number;
}

function TargetGPAPanel({ currentGPA, currentCredits, onCalculate }: TargetGPAPanelProps) {
  const [targetGPA, setTargetGPA] = useState(3.5);
  const result = onCalculate(currentGPA, currentCredits, targetGPA);

  return (
    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target size={14} className="text-blue-400" />
        <span className="text-xs font-bold text-blue-300">Target GPA Calculator</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-mono text-slate-500 uppercase">
            Target
          </label>
          <input
            type="number"
            min={0}
            max={4.0}
            step={0.1}
            value={targetGPA}
            onChange={(e) => setTargetGPA(Math.min(4.0, Math.max(0, Number(e.target.value))))}
            className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-slate-400 pt-4">
          {result > 0 ? (
            <span>
              Need <span className="font-bold text-blue-400">{result} credits</span> at 4.0 to
              reach {targetGPA.toFixed(1)} GPA
            </span>
          ) : (
            <span className="text-emerald-400">Already at or above target!</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CourseGradeCalculator() {
  const {
    courses,
    stats,
    addCourse,
    removeCourse,
    updateCourse,
    toggleDropped,
    clearAllData,
    calculateTargetGPA,
  } = useGradeCalculator();

  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedSemester, setExpandedSemester] = useState<string | null>(null);
  const [showTarget, setShowTarget] = useState(false);

  // Max count for distribution bar
  const maxCount = Math.max(1, ...Object.values(stats.gradeDistribution));

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6 shadow-xl max-w-2xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/20">
            <GraduationCap size={18} className="text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Grade Calculator</h3>
            <p className="text-[10px] text-slate-500 font-mono">
              Track courses and calculate your GPA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTarget(!showTarget)}
            className={`flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 border transition-all ${
              showTarget
                ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
            }`}
          >
            <Target size={14} />
            Target
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-xs font-bold rounded-xl px-3 py-2 transition-all"
          >
            <Plus size={14} />
            Add
          </button>
          <button
            onClick={clearAllData}
            className="p-2 rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
            aria-label="Clear all data"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Cumulative GPA Hero */}
      <div className="flex items-center gap-5 mb-5 p-4 bg-slate-800/50 border border-slate-700/40 rounded-xl">
        <div className="flex flex-col items-center">
          <span className="text-4xl font-black text-slate-100 tabular-nums leading-none">
            {formatGPA(stats.cumulativeGPA)}
          </span>
          <span className="text-xs font-mono text-slate-500 mt-1">GPA</span>
        </div>
        <div className="h-12 w-px bg-slate-700" />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Award size={12} className="text-blue-400" />
            <span className="text-xs text-slate-400">
              Letter: <span className="font-bold text-slate-200">{getGPALetter(stats.cumulativeGPA)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen size={12} className="text-cyan-400" />
            <span className="text-xs text-slate-400">
              <span className="font-bold text-slate-200">{stats.totalCredits}</span> credits
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={12} className="text-emerald-400" />
            <span className="text-xs text-slate-400">
              <span className="font-bold text-slate-200">{stats.totalCourseCount}</span> courses
            </span>
          </div>
        </div>
      </div>

      {/* Target GPA */}
      {showTarget && (
        <div className="mb-5">
          <TargetGPAPanel
            currentGPA={stats.cumulativeGPA}
            currentCredits={stats.totalCredits}
            onCalculate={calculateTargetGPA}
          />
        </div>
      )}

      {/* Grade Distribution */}
      {Object.keys(stats.gradeDistribution).length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={12} className="text-slate-500" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              Grade Distribution
            </span>
          </div>
          <div className="flex items-end gap-1 h-16">
            {LETTER_GRADES.map((letter) => {
              const count = stats.gradeDistribution[letter] ?? 0;
              const height = count > 0 ? Math.max(12, (count / maxCount) * 100) : 4;
              return (
                <div key={letter} className="flex-1 flex flex-col items-center gap-1">
                  {count > 0 && (
                    <span className="text-[8px] font-mono text-slate-500">{count}</span>
                  )}
                  <div
                    className={`w-full rounded-t-sm transition-all duration-500 ${
                      count > 0 ? BAR_COLORS[letter] : "bg-slate-800/50"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[8px] font-mono text-slate-600">{letter}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Semesters */}
      {stats.semesters.length > 0 ? (
        <div className="space-y-3">
          {stats.semesters.map((semester) => {
            const isExpanded = expandedSemester === semester.name;
            return (
              <div
                key={semester.name}
                className="border border-slate-700/40 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedSemester(isExpanded ? null : semester.name)
                  }
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/40 hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-200">
                      {semester.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {semester.courses.length} course{semester.courses.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-blue-400">
                      {formatGPA(semester.semesterGPA)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {semester.totalCredits}cr
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={14} className="text-slate-500" />
                    ) : (
                      <ChevronDown size={14} className="text-slate-500" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 py-2 space-y-1.5">
                    {semester.courses.map((course) => (
                      <div
                        key={course.id}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                          course.isDropped
                            ? "bg-slate-800/20 opacity-50"
                            : "bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-xs text-slate-300 truncate">
                            {course.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-600 shrink-0">
                            {course.credits}cr
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-mono font-bold ${
                              GRADE_COLORS[gradeToLetter(course.grade, course.gradeType)] ?? "text-slate-400"
                            }`}
                          >
                            {course.grade}
                          </span>
                          <button
                            onClick={() => toggleDropped(course.id)}
                            className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-amber-400 transition-colors"
                            title={course.isDropped ? "Restore" : "Drop"}
                          >
                            <RotateCcw size={10} />
                          </button>
                          <button
                            onClick={() => removeCourse(course.id)}
                            className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-red-400 transition-colors"
                            aria-label="Remove course"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <GraduationCap size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-xs text-slate-500 mb-1">No courses added yet</p>
          <p className="text-[10px] text-slate-600">
            Click "Add" to start tracking your grades
          </p>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddCourseModal
          onAdd={addCourse}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
