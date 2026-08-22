import { useState } from "react";
import {
  ClipboardList,
  Plus,
  Trash2,
  X,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  BarChart3,
  Filter,
  SortAsc,
  Target,
  Flame,
  BookOpen,
} from "lucide-react";
import {
  useAssignments,
  type Priority,
  type Category,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  PRIORITY_COLORS,
  daysUntil,
  formatCountdown,
  getStatus,
} from "../../hooks/useAssignments";

const PRIORITY_OPTIONS: Priority[] = ["critical", "high", "medium", "low"];
const CATEGORY_OPTIONS: Category[] = ["homework", "exam", "project", "essay", "lab", "reading", "other"];

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCountdownColor(daysLeft: number): string {
  if (daysLeft < 0) return "text-red-400";
  if (daysLeft === 0) return "text-red-400";
  if (daysLeft <= 2) return "text-orange-400";
  if (daysLeft <= 5) return "text-amber-400";
  return "text-slate-400";
}

interface AddAssignmentModalProps {
  onAdd: (
    data: Omit<
      import("../../hooks/useAssignments").Assignment,
      "id" | "status" | "createdAt" | "completedAt" | "reminderSet"
    >,
  ) => void;
  onClose: () => void;
}

function AddAssignmentModal({ onAdd, onClose }: AddAssignmentModalProps) {
  const [title, setTitle] = useState("");
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [category, setCategory] = useState<Category>("homework");
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    onAdd({
      title: title.trim(),
      courseName: courseName.trim() || "General",
      courseCode: courseCode.trim() || "GEN",
      description: description.trim(),
      dueDate: new Date(dueDate).toISOString(),
      priority,
      category,
      estimatedMinutes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-bold text-slate-100">New Assignment</h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {/* Title */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Problem Set 5"
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Course */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Course Name</label>
              <input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="Intro to CS"
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Course Code</label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="CS 101"
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={2}
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Due Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Due Date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
              required
            />
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Priority</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`text-[10px] font-mono rounded-xl py-2 border transition-all capitalize ${
                    priority === p
                      ? `${PRIORITY_COLORS[p].bg} ${PRIORITY_COLORS[p].border} ${PRIORITY_COLORS[p].text}`
                      : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Category + Estimated */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Est. Time (min)</label>
              <input
                type="number"
                min={5}
                max={600}
                step={5}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
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
            disabled={!title.trim() || !dueDate}
            className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-xs rounded-xl py-2.5 transition-colors"
          >
            Add Assignment
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AssignmentTracker() {
  const {
    filteredAssignments,
    stats,
    addAssignment,
    removeAssignment,
    toggleComplete,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    searchTerm,
    setSearchTerm,
  } = useAssignments();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6 shadow-xl max-w-2xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/20">
            <ClipboardList size={18} className="text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Assignments</h3>
            <p className="text-[10px] text-slate-500 font-mono">
              {stats.dueToday > 0 && (
                <span className="text-red-400">{stats.dueToday} due today </span>
              )}
              {stats.dueThisWeek > 0 && (
                <span className="text-amber-400">{stats.dueThisWeek} due this week</span>
              )}
              {stats.dueToday === 0 && stats.dueThisWeek === 0 && (
                <span>{stats.pending + stats.inProgress} active assignments</span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-xs font-bold rounded-xl px-3 py-2 transition-all"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          {
            icon: Clock,
            label: "Pending",
            value: stats.pending,
            color: "bg-slate-500/10 text-slate-400",
          },
          {
            icon: Target,
            label: "In Progress",
            value: stats.inProgress,
            color: "bg-blue-500/10 text-blue-400",
          },
          {
            icon: CheckCircle2,
            label: "Done",
            value: stats.completed,
            color: "bg-emerald-500/10 text-emerald-400",
          },
          {
            icon: AlertTriangle,
            label: "Overdue",
            value: stats.overdue,
            color: "bg-red-500/10 text-red-400",
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700/30 ${color}`}
          >
            <Icon size={12} />
            <div className="flex flex-col">
              <span className="text-sm font-bold tabular-nums">{value}</span>
              <span className="text-[8px] font-mono uppercase opacity-60">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Completion</span>
          <span className="text-[10px] font-mono text-slate-400">
            {Math.round(stats.completionRate * 100)}%
          </span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${stats.completionRate * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-slate-600">
            {formatMinutes(stats.completedMinutes)} done
          </span>
          <span className="text-[9px] text-slate-600">
            {formatMinutes(stats.totalEstimatedMinutes)} total
          </span>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search assignments..."
            className="w-full bg-slate-800/60 border border-slate-700/40 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-xl border transition-all ${
            showFilters || activeFilter !== "all"
              ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
              : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
          }`}
        >
          <Filter size={14} />
        </button>
        <button
          onClick={() =>
            setSortBy(sortBy === "dueDate" ? "priority" : sortBy === "priority" ? "course" : "dueDate")
          }
          className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-500 hover:text-slate-300 transition-all"
          title={`Sort by ${sortBy}`}
        >
          <SortAsc size={14} />
        </button>
      </div>

      {/* Filter Chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setActiveFilter("all")}
            className={`text-[10px] font-mono rounded-lg px-2.5 py-1 border transition-all ${
              activeFilter === "all"
                ? "bg-slate-600 border-slate-500 text-slate-200"
                : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
            }`}
          >
            All
          </button>
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setActiveFilter(c)}
              className={`text-[10px] font-mono rounded-lg px-2.5 py-1 border transition-all ${
                activeFilter === c
                  ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                  : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
              }`}
            >
              {CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      )}

      {/* Assignment List */}
      {filteredAssignments.length > 0 ? (
        <div className="space-y-2">
          {filteredAssignments.map((assignment) => {
            const status = getStatus(assignment);
            const days = daysUntil(assignment.dueDate);
            const colors = PRIORITY_COLORS[assignment.priority];
            const isCompleted = status === "completed";

            return (
              <div
                key={assignment.id}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                  isCompleted
                    ? "bg-emerald-500/5 border-emerald-500/15 opacity-60"
                    : status === "overdue"
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-slate-800/40 border-slate-700/40 hover:border-slate-600/60"
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleComplete(assignment.id)}
                  className={`mt-0.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                    isCompleted
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-slate-600 hover:border-slate-400"
                  }`}
                >
                  {isCompleted && <CheckCircle2 size={12} className="text-white" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        isCompleted ? "text-slate-500 line-through" : "text-slate-200"
                      }`}
                    >
                      {assignment.title}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${colors.bg} ${colors.text} border ${colors.border}`}>
                      {assignment.priority}
                    </span>
                    <span className="text-[9px] text-slate-600">
                      {CATEGORY_ICONS[assignment.category]}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <BookOpen size={9} />
                    <span>
                      {assignment.courseCode} — {assignment.courseName}
                    </span>
                  </div>

                  {assignment.description && (
                    <p className="text-[10px] text-slate-600 mt-1 line-clamp-1">
                      {assignment.description}
                    </p>
                  )}
                </div>

                {/* Right side: countdown + time */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] font-mono font-bold ${getCountdownColor(days)}`}>
                    {formatCountdown(assignment.dueDate, status)}
                  </span>
                  <span className="text-[9px] text-slate-600">
                    {formatMinutes(assignment.estimatedMinutes)}
                  </span>
                  <span className="text-[9px] text-slate-600">
                    {formatDate(assignment.dueDate)}
                  </span>
                  <button
                    onClick={() => removeAssignment(assignment.id)}
                    className="p-1 rounded hover:bg-red-500/10 text-slate-700 hover:text-red-400 transition-colors mt-0.5"
                    aria-label="Remove assignment"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10">
          <ClipboardList size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-xs text-slate-500 mb-1">
            {searchTerm || activeFilter !== "all"
              ? "No assignments match your filter"
              : "No assignments yet"}
          </p>
          <p className="text-[10px] text-slate-600">
            {searchTerm || activeFilter !== "all"
              ? "Try adjusting your search or filters"
              : 'Click "Add" to create your first assignment'}
          </p>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddAssignmentModal
          onAdd={addAssignment}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
