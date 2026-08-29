import { useState, useCallback, useEffect, useMemo } from "react";

export type Priority = "critical" | "high" | "medium" | "low";
export type Category = "homework" | "exam" | "project" | "essay" | "lab" | "reading" | "other";
export type AssignmentStatus = "pending" | "in-progress" | "completed" | "overdue";

export interface Assignment {
  id: string;
  title: string;
  courseName: string;
  courseCode: string;
  description: string;
  dueDate: string; // ISO string
  priority: Priority;
  category: Category;
  estimatedMinutes: number;
  status: AssignmentStatus;
  createdAt: string;
  completedAt: string | null;
  reminderSet: boolean;
}

export interface AssignmentStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  totalEstimatedMinutes: number;
  completedMinutes: number;
  completionRate: number;
}

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const CATEGORY_LABELS: Record<Category, string> = {
  homework: "Homework",
  exam: "Exam",
  project: "Project",
  essay: "Essay",
  lab: "Lab",
  reading: "Reading",
  other: "Other",
};

const PRIORITY_COLORS: Record<Priority, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/25", dot: "bg-red-500" },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/25", dot: "bg-orange-500" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/25", dot: "bg-amber-500" },
  low: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/25", dot: "bg-slate-500" },
};

const CATEGORY_ICONS: Record<Category, string> = {
  homework: "📝",
  exam: "🎓",
  project: "🔧",
  essay: "✍️",
  lab: "🔬",
  reading: "📚",
  other: "📌",
};

const STORAGE_KEY = "cc-assignments";

function nowISO(): string {
  return new Date().toISOString();
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysUntil(dueDate: string): number {
  const due = new Date(dueDate);
  const now = todayStart();
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function hoursUntil(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.max(0, (due.getTime() - now.getTime()) / (1000 * 60 * 60));
}

function formatCountdown(dueDate: string, status: AssignmentStatus): string {
  if (status === "completed") return "Done ✓";
  const days = daysUntil(dueDate);
  const hours = hoursUntil(dueDate);

  if (days < 0) return `Overdue by ${Math.abs(days)}d`;
  if (days === 0) {
    if (hours < 1) return `${Math.max(0, Math.round(hours * 60))}m left`;
    return `${Math.round(hours)}h left`;
  }
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `${days} days left`;
  return `${days} days left`;
}

function getStatus(assignment: Assignment): AssignmentStatus {
  if (assignment.status === "completed") return "completed";
  if (daysUntil(assignment.dueDate) < 0) return "overdue";
  return assignment.status;
}

function loadAssignments(): Assignment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAssignments(assignments: Assignment[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
}

function isDueThisWeek(dueDate: string): boolean {
  const days = daysUntil(dueDate);
  return days >= 0 && days <= 7;
}

export interface UseAssignmentsReturn {
  assignments: Assignment[];
  filteredAssignments: Assignment[];
  stats: AssignmentStats;
  addAssignment: (data: Omit<Assignment, "id" | "status" | "createdAt" | "completedAt" | "reminderSet">) => void;
  removeAssignment: (id: string) => void;
  updateAssignment: (id: string, patch: Partial<Omit<Assignment, "id">>) => void;
  toggleComplete: (id: string) => void;
  setPriority: (id: string, priority: Priority) => void;
  setStatus: (id: string, status: AssignmentStatus) => void;
  clearAllData: () => void;
  activeFilter: Category | "all";
  setActiveFilter: (filter: Category | "all") => void;
  sortBy: "dueDate" | "priority" | "course";
  setSortBy: (sort: "dueDate" | "priority" | "course") => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export function useAssignments(): UseAssignmentsReturn {
  const [assignments, setAssignments] = useState<Assignment[]>(loadAssignments);
  const [activeFilter, setActiveFilter] = useState<Category | "all">("all");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "course">("dueDate");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    saveAssignments(assignments);
  }, [assignments]);

  // Auto-update overdue status
  useEffect(() => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.status !== "completed" && daysUntil(a.dueDate) < 0) {
          return { ...a, status: "overdue" as AssignmentStatus };
        }
        return a;
      }),
    );
  }, []);

  const filteredAssignments = useMemo(() => {
    let result = [...assignments];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(term) ||
          a.courseName.toLowerCase().includes(term) ||
          a.courseCode.toLowerCase().includes(term) ||
          a.description.toLowerCase().includes(term),
      );
    }

    // Category filter
    if (activeFilter !== "all") {
      result = result.filter((a) => a.category === activeFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "dueDate") {
        const statusA = getStatus(a);
        const statusB = getStatus(b);
        // Completed always last
        if (statusA === "completed" && statusB !== "completed") return 1;
        if (statusA !== "completed" && statusB === "completed") return -1;
        // Overdue first
        if (statusA === "overdue" && statusB !== "overdue") return -1;
        if (statusA !== "overdue" && statusB === "overdue") return 1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "priority") {
        const statusA = getStatus(a);
        const statusB = getStatus(b);
        if (statusA === "completed" && statusB !== "completed") return 1;
        if (statusA !== "completed" && statusB === "completed") return -1;
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      }
      // course
      return a.courseCode.localeCompare(b.courseCode);
    });

    return result;
  }, [assignments, activeFilter, sortBy, searchTerm]);

  const stats = useMemo((): AssignmentStats => {
    const active = assignments.filter((a) => a.status !== "completed");
    const completed = assignments.filter((a) => a.status === "completed");
    const overdue = active.filter((a) => daysUntil(a.dueDate) < 0);
    const dueToday = active.filter((a) => daysUntil(a.dueDate) === 0);
    const dueThisWeek = active.filter((a) => isDueThisWeek(a.dueDate));

    const totalEstimated = assignments.reduce((sum, a) => sum + a.estimatedMinutes, 0);
    const completedMins = completed.reduce((sum, a) => sum + a.estimatedMinutes, 0);

    return {
      total: assignments.length,
      pending: active.filter((a) => a.status === "pending").length,
      inProgress: active.filter((a) => a.status === "in-progress").length,
      completed: completed.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      dueThisWeek: dueThisWeek.length,
      totalEstimatedMinutes: totalEstimated,
      completedMinutes: completedMins,
      completionRate: assignments.length > 0 ? completed.length / assignments.length : 0,
    };
  }, [assignments]);

  const addAssignment = useCallback(
    (data: Omit<Assignment, "id" | "status" | "createdAt" | "completedAt" | "reminderSet">) => {
      const newAssignment: Assignment = {
        ...data,
        id: `asgn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        status: daysUntil(data.dueDate) < 0 ? "overdue" : "pending",
        createdAt: nowISO(),
        completedAt: null,
        reminderSet: false,
      };
      setAssignments((prev) => [...prev, newAssignment]);
    },
    [],
  );

  const removeAssignment = useCallback((id: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const updateAssignment = useCallback((id: string, patch: Partial<Omit<Assignment, "id">>) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  }, []);

  const toggleComplete = useCallback((id: string) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const wasCompleted = a.status === "completed";
        return {
          ...a,
          status: wasCompleted ? "pending" : ("completed" as AssignmentStatus),
          completedAt: wasCompleted ? null : nowISO(),
        };
      }),
    );
  }, []);

  const setPriority = useCallback((id: string, priority: Priority) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, priority } : a)),
    );
  }, []);

  const setStatus = useCallback((id: string, status: AssignmentStatus) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status, completedAt: status === "completed" ? nowISO() : null }
          : a,
      ),
    );
  }, []);

  const clearAllData = useCallback(() => {
    setAssignments([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    assignments,
    filteredAssignments,
    stats,
    addAssignment,
    removeAssignment,
    updateAssignment,
    toggleComplete,
    setPriority,
    setStatus,
    clearAllData,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    searchTerm,
    setSearchTerm,
  };
}

export {
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  PRIORITY_COLORS,
  PRIORITY_ORDER,
  daysUntil,
  formatCountdown,
  getStatus,
};
