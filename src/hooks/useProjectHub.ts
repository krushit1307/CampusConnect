import { useState, useCallback, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type TaskStatus = "backlog" | "todo" | "in-progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ProjectStatus = "planning" | "active" | "on-hold" | "completed";

export interface ProjectMember {
  userId: string;
  name: string;
  avatar: string;
  role: "lead" | "developer" | "designer" | "tester" | "member";
  joinedAt: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: ProjectMember;
  tags: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  estimatedHours: number;
  loggedHours: number;
  subtasks: { id: string; title: string; completed: boolean }[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  icon: string;
  members: ProjectMember[];
  tasks: ProjectTask[];
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  repoUrl?: string;
  tags: string[];
  progress: number;
}

export interface ProjectFilter {
  status: ProjectStatus | null;
  searchQuery: string;
  memberFilter: string | null;
}

export interface HubStats {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalMembers: number;
  avgCompletionRate: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const PROJECT_NAMES = [
  "Campus Rideshare App",
  "AI Study Buddy",
  "Club Voting Platform",
  "Event Budget Tracker",
  "Peer Tutoring Network",
  "Lost & Found App",
  "Sustainability Dashboard",
  "Course Review Aggregator",
];

const PROJECT_DESCRIPTIONS = [
  "A mobile-first ridesharing platform for students to share rides to campus and nearby areas.",
  "An AI-powered study assistant that generates practice problems and explains concepts.",
  "A secure, anonymous voting platform for club elections and decision-making.",
  "Track event budgets, expenses, and generate financial reports for club treasurers.",
  "Connect students who need help with qualified peer tutors across all departments.",
  "Report and find lost items across campus with photo matching and location tracking.",
  "Monitor campus energy usage, waste reduction, and sustainability goals in real-time.",
  "Aggregate and moderate course reviews from verified students across all departments.",
];

const MEMBER_NAMES = [
  "Alice Zhang",
  "Bob Martinez",
  "Clara Kim",
  "David Okonkwo",
  "Emma Liu",
  "Frank Patel",
  "Grace Nguyen",
  "Hiro Yamamoto",
  "Irene Popov",
  "Jake Wilson",
  "Kira Sharma",
  "Leo Anderson",
  "Maya Johnson",
  "Noah Brown",
  "Olivia Davis",
  "Pablo Garcia",
];

const TAGS = [
  "React",
  "TypeScript",
  "Supabase",
  "Tailwind",
  "Node.js",
  "Python",
  "ML",
  "Mobile",
  "API",
  "Design",
  "Testing",
  "DevOps",
];

const TASK_TITLE_PREFIXES: Record<string, string[]> = {
  "Campus Rideshare App": [
    "Implement ride matching",
    "Add payment integration",
    "Build driver rating system",
    "Create ride scheduling",
    "Design route optimization",
  ],
  "AI Study Buddy": [
    "Train question generator",
    "Build flashcard system",
    "Add spaced repetition",
    "Implement progress tracking",
    "Create explanation engine",
  ],
  "Club Voting Platform": [
    "Set up secure voting",
    "Add candidate profiles",
    "Implement ballot verification",
    "Build results dashboard",
    "Add election scheduling",
  ],
  "Event Budget Tracker": [
    "Create expense categories",
    "Build budget forecasting",
    "Add receipt scanning",
    "Generate financial reports",
    "Implement approval workflow",
  ],
  "Peer Tutoring Network": [
    "Build tutor matching",
    "Add scheduling system",
    "Create session recording",
    "Implement feedback loop",
    "Build availability calendar",
  ],
  "Lost & Found App": [
    "Add photo upload",
    "Implement item matching",
    "Build notification system",
    "Create location mapping",
    "Add claim verification",
  ],
  "Sustainability Dashboard": [
    "Integrate energy sensors",
    "Build carbon calculator",
    "Create goal tracking",
    "Add community challenges",
    "Implement data visualization",
  ],
  "Course Review Aggregator": [
    "Build review submission",
    "Add moderation system",
    "Create rating algorithms",
    "Implement search/filter",
    "Build professor profiles",
  ],
};

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
];
const ICONS = ["🚀", "🤖", "🗳️", "💰", "🎓", "🔍", "🌱", "📚"];
const STATUSES: ProjectStatus[] = ["planning", "active", "on-hold", "completed"];
const TASK_STATUSES: TaskStatus[] = ["backlog", "todo", "in-progress", "review", "done"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const ROLES: ProjectMember["role"][] = ["lead", "developer", "designer", "tester", "member"];

function generateProjects(seed: number): Project[] {
  const rng = seededRandom(seed);
  const projects: Project[] = [];

  PROJECT_NAMES.forEach((name, i) => {
    const memberCount = 3 + Math.floor(rng() * 4);
    const members: ProjectMember[] = Array.from({ length: memberCount }, (_, m) => {
      const memberName = MEMBER_NAMES[Math.floor(rng() * MEMBER_NAMES.length)];
      return {
        userId: `u-${i}-${m}`,
        name: memberName,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${memberName.replace(" ", "")}`,
        role: ROLES[m === 0 ? 0 : Math.floor(rng() * ROLES.length)],
        joinedAt: new Date(Date.now() - Math.floor(rng() * 90) * 86400000).toISOString(),
      };
    });

    const taskCount = 8 + Math.floor(rng() * 12);
    const taskTitles = TASK_TITLE_PREFIXES[name] || [
      "Setup project",
      "Build core features",
      "Add testing",
      "Deploy",
    ];

    const tasks: ProjectTask[] = Array.from({ length: taskCount }, (_, t) => {
      const title =
        t < taskTitles.length
          ? taskTitles[t]
          : `Task ${t + 1}: ${taskTitles[t % taskTitles.length]}`;
      const status = TASK_STATUSES[Math.floor(rng() * TASK_STATUSES.length)];
      const estimatedHours = 2 + Math.floor(rng() * 16);
      const loggedHours = status === "done" ? estimatedHours : Math.floor(rng() * estimatedHours);
      const subtaskCount = Math.floor(rng() * 4);

      return {
        id: `task-${i}-${t}`,
        projectId: `proj-${i}`,
        title,
        description: `Detailed description for: ${title}. This task involves careful planning and execution.`,
        status,
        priority: PRIORITIES[Math.floor(rng() * PRIORITIES.length)],
        assignee: members[Math.floor(rng() * members.length)],
        tags: Array.from(
          { length: 1 + Math.floor(rng() * 3) },
          () => TAGS[Math.floor(rng() * TAGS.length)],
        ),
        dueDate:
          status !== "done"
            ? new Date(Date.now() + Math.floor(rng() * 30 - 5) * 86400000)
                .toISOString()
                .slice(0, 10)
            : undefined,
        createdAt: new Date(Date.now() - Math.floor(rng() * 60) * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - Math.floor(rng() * 7) * 86400000).toISOString(),
        estimatedHours,
        loggedHours,
        subtasks: Array.from({ length: subtaskCount }, (_, st) => ({
          id: `sub-${i}-${t}-${st}`,
          title: `Subtask ${st + 1}`,
          completed: rng() > 0.5,
        })),
      };
    });

    const doneCount = tasks.filter((t) => t.status === "done").length;
    const progress = Math.round((doneCount / tasks.length) * 100);
    const status =
      progress === 100
        ? "completed"
        : progress > 50
          ? "active"
          : progress > 20
            ? "active"
            : STATUSES[Math.floor(rng() * STATUSES.length)];

    projects.push({
      id: `proj-${i}`,
      name,
      description: PROJECT_DESCRIPTIONS[i],
      status,
      color: COLORS[i % COLORS.length],
      icon: ICONS[i % ICONS.length],
      members,
      tasks,
      createdAt: new Date(Date.now() - Math.floor(rng() * 120) * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - Math.floor(rng() * 7) * 86400000).toISOString(),
      deadline: new Date(Date.now() + Math.floor(rng() * 60 + 10) * 86400000)
        .toISOString()
        .slice(0, 10),
      tags: Array.from(new Set(tasks.flatMap((t) => t.tags))).slice(0, 5),
      progress,
    });
  });

  return projects;
}

function computeTaskColumnWidths(tasks: ProjectTask[]): Record<TaskStatus, number> {
  const widths: Record<TaskStatus, number> = {
    backlog: 0,
    todo: 0,
    "in-progress": 0,
    review: 0,
    done: 0,
  };
  tasks.forEach((t) => {
    widths[t.status]++;
  });
  return widths;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useProjectHub() {
  const [allProjects, setAllProjects] = useState<Project[]>(() => generateProjects(42));
  const [filters, setFilters] = useState<ProjectFilter>({
    status: null,
    searchQuery: "",
    memberFilter: null,
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const filteredProjects = useMemo(
    () =>
      allProjects.filter((p) => {
        if (filters.status && p.status !== filters.status) return false;
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q))
            return false;
        }
        if (filters.memberFilter && !p.members.some((m) => m.userId === filters.memberFilter))
          return false;
        return true;
      }),
    [allProjects, filters],
  );

  const selectedProject = useMemo(
    () =>
      selectedProjectId ? (allProjects.find((p) => p.id === selectedProjectId) ?? null) : null,
    [allProjects, selectedProjectId],
  );

  const taskColumns = useMemo(
    () => (selectedProject ? computeTaskColumnWidths(selectedProject.tasks) : null),
    [selectedProject],
  );

  const stats: HubStats = useMemo(() => {
    const allTasks = allProjects.flatMap((p) => p.tasks);
    const allMembers = new Set(allProjects.flatMap((p) => p.members.map((m) => m.userId)));
    const completedTasks = allTasks.filter((t) => t.status === "done");
    const overdueTasks = allTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done",
    );
    return {
      totalProjects: allProjects.length,
      activeProjects: allProjects.filter((p) => p.status === "active").length,
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      totalMembers: allMembers.size,
      avgCompletionRate:
        allProjects.length > 0
          ? Math.round(allProjects.reduce((s, p) => s + p.progress, 0) / allProjects.length)
          : 0,
    };
  }, [allProjects]);

  const moveTask = useCallback((taskId: string, newStatus: TaskStatus) => {
    setAllProjects((prev) =>
      prev.map((project) => ({
        ...project,
        tasks: project.tasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t,
        ),
        progress: Math.round(
          (project.tasks.filter((t) =>
            t.id === taskId ? newStatus === "done" : t.status === "done",
          ).length /
            project.tasks.length) *
            100,
        ),
      })),
    );
  }, []);

  const updateFilters = useCallback(
    (patch: Partial<ProjectFilter>) => setFilters((f) => ({ ...f, ...patch })),
    [],
  );

  const resetFilters = useCallback(
    () => setFilters({ status: null, searchQuery: "", memberFilter: null }),
    [],
  );

  return {
    allProjects,
    filteredProjects,
    selectedProject,
    taskColumns,
    selectedProjectId,
    setSelectedProjectId,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    stats,
    filters,
    updateFilters,
    resetFilters,
    moveTask,
  };
}
