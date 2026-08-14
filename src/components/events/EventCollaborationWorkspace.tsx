import React, { useState, useMemo } from "react";
import Users from "lucide-react/dist/esm/icons/users";
import CheckSquare from "lucide-react/dist/esm/icons/check-square";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Circle from "lucide-react/dist/esm/icons/circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import Filter from "lucide-react/dist/esm/icons/filter";
import Search from "lucide-react/dist/esm/icons/search";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import UserPlus from "lucide-react/dist/esm/icons/user-plus";
import Shield from "lucide-react/dist/esm/icons/shield";
import Tag from "lucide-react/dist/esm/icons/tag";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import PieChart from "lucide-react/dist/esm/icons/pie-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface TaskItem {
  id: string;
  title: string;
  assignee: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
  dueDate: string;
  budgetAllocated: number;
}

export interface OrganizerMember {
  id: string;
  name: string;
  role: "Lead" | "Logistics" | "Marketing" | "Volunteer";
  email: string;
  avatarUrl?: string;
  tasksCount: number;
}

export interface EventCollaborationWorkspaceProps {
  eventId: string;
  eventTitle: string;
}

export const EventCollaborationWorkspace: React.FC<EventCollaborationWorkspaceProps> = ({
  eventId,
  eventTitle,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: "t-1",
      title: "Finalize main stage AV & microphone setup",
      assignee: "Alex Morgan",
      priority: "high",
      completed: false,
      dueDate: "2026-08-05",
      budgetAllocated: 1500,
    },
    {
      id: "t-2",
      title: "Print 500 promotional flyers & badges",
      assignee: "Sam Taylor",
      priority: "medium",
      completed: true,
      dueDate: "2026-08-02",
      budgetAllocated: 300,
    },
    {
      id: "t-3",
      title: "Confirm catering menu & dietary preferences",
      assignee: "Jordan Lee",
      priority: "high",
      completed: false,
      dueDate: "2026-08-04",
      budgetAllocated: 2200,
    },
    {
      id: "t-4",
      title: "Setup check-in QR scanner terminals at entrance",
      assignee: "Chris Patel",
      priority: "low",
      completed: false,
      dueDate: "2026-08-06",
      budgetAllocated: 400,
    },
  ]);

  const [organizers, setOrganizers] = useState<OrganizerMember[]>([
    {
      id: "org-1",
      name: "Alex Morgan",
      role: "Lead",
      email: "alex.m@campus.edu",
      tasksCount: 1,
    },
    {
      id: "org-2",
      name: "Sam Taylor",
      role: "Marketing",
      email: "sam.t@campus.edu",
      tasksCount: 1,
    },
    {
      id: "org-3",
      name: "Jordan Lee",
      role: "Logistics",
      email: "jordan.l@campus.edu",
      tasksCount: 1,
    },
    {
      id: "org-4",
      name: "Chris Patel",
      role: "Volunteer",
      email: "chris.p@campus.edu",
      tasksCount: 1,
    },
  ]);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("Alex Morgan");
  const [newTaskPriority, setNewTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [newTaskBudget, setNewTaskBudget] = useState("0");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [newOrgRole, setNewOrgRole] = useState<"Lead" | "Logistics" | "Marketing" | "Volunteer">(
    "Volunteer",
  );

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      toast.error("Task title cannot be empty");
      return;
    }

    const newTask: TaskItem = {
      id: `t-${Date.now()}`,
      title: newTaskTitle.trim(),
      assignee: newTaskAssignee,
      priority: newTaskPriority,
      completed: false,
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
      budgetAllocated: parseFloat(newTaskBudget) || 0,
    };

    setTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle("");
    setNewTaskBudget("0");
    toast.success("Task added to event workspace");
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    toast.info("Task removed");
  };

  const handleAddOrganizer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgEmail.trim()) {
      toast.error("Please fill in organizer name and email");
      return;
    }

    const newOrg: OrganizerMember = {
      id: `org-${Date.now()}`,
      name: newOrgName.trim(),
      email: newOrgEmail.trim(),
      role: newOrgRole,
      tasksCount: 0,
    };

    setOrganizers((prev) => [...prev, newOrg]);
    setNewOrgName("");
    setNewOrgEmail("");
    toast.success(`${newOrg.name} added to organizer team`);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesPriority = filterPriority === "all" || t.priority === filterPriority;
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assignee.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPriority && matchesSearch;
    });
  }, [tasks, filterPriority, searchQuery]);

  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);
  const progressPercentage = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((completedCount / tasks.length) * 100);
  }, [completedCount, tasks.length]);

  const totalBudget = useMemo(() => {
    return tasks.reduce((sum, t) => sum + t.budgetAllocated, 0);
  }, [tasks]);

  return (
    <div className="space-y-8 rounded-xl border-2 border-black bg-cream p-6 shadow-md dark:border-cream dark:bg-black dark:text-cream">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b-2 border-black pb-4 dark:border-cream">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">
              Organizer Workspace
            </h2>
          </div>
          <p className="font-mono text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            Real-time planning & team task board for{" "}
            <span className="font-semibold text-black dark:text-white">{eventTitle}</span> (ID:{" "}
            {eventId})
          </p>
        </div>

        {/* Progress gauge & budget */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-black bg-white px-3 py-1.5 font-mono text-xs dark:bg-neutral-900 dark:border-cream">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span>
              Est. Budget: <strong>${totalBudget.toLocaleString()}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-black bg-lime px-3 py-1.5 font-mono text-xs font-bold text-black">
            <TrendingUp className="h-4 w-4" />
            <span>Progress: {progressPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Task Management Column (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-mono text-sm font-bold uppercase flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-blue-600" /> Event Execution Tasks (
              {tasks.length})
            </h3>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                <Input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-36 pl-8 font-mono text-xs bg-white dark:bg-neutral-900"
                />
              </div>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="h-8 rounded-md border border-black bg-white px-2 font-mono text-xs dark:bg-neutral-900 dark:border-cream"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Add Task Form */}
          <form
            onSubmit={handleAddTask}
            className="flex flex-col gap-3 rounded-lg border border-black bg-white p-4 dark:bg-neutral-900 dark:border-cream"
          >
            <div className="font-mono text-xs font-bold uppercase text-neutral-500">
              Quick Add Task
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                placeholder="Task description..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="font-mono text-xs"
              />

              <div className="flex items-center gap-2">
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="h-9 w-full rounded-md border border-black bg-cream px-2 font-mono text-xs dark:bg-black dark:border-cream"
                >
                  {organizers.map((o) => (
                    <option key={o.id} value={o.name}>
                      {o.name} ({o.role})
                    </option>
                  ))}
                </select>

                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as "high" | "medium" | "low")}
                  className="h-9 rounded-md border border-black bg-cream px-2 font-mono text-xs dark:bg-black dark:border-cream"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-neutral-500">Budget ($):</span>
                <Input
                  type="number"
                  value={newTaskBudget}
                  onChange={(e) => setNewTaskBudget(e.target.value)}
                  className="h-8 w-24 font-mono text-xs"
                />
              </div>

              <Button
                type="submit"
                size="sm"
                className="font-mono text-xs uppercase bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
              </Button>
            </div>
          </form>

          {/* Task List */}
          <div className="space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="py-8 text-center font-mono text-xs text-neutral-500 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg">
                No matching tasks found for this event.
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center justify-between gap-4 rounded-lg border border-black p-3.5 transition-all dark:border-cream ${
                    task.completed
                      ? "bg-neutral-100 opacity-60 dark:bg-neutral-900"
                      : "bg-white dark:bg-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task.id)}
                      className="shrink-0 text-black dark:text-cream hover:opacity-75"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-neutral-400" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <p
                        className={`font-mono text-xs font-semibold truncate ${
                          task.completed ? "line-through text-neutral-500" : ""
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-500 mt-0.5">
                        <span>Assignee: {task.assignee}</span>
                        <span>Due: {task.dueDate}</span>
                        {task.budgetAllocated > 0 && (
                          <span className="text-emerald-700 font-bold">
                            ${task.budgetAllocated}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        task.priority === "high"
                          ? "bg-rose-100 text-rose-800 border border-rose-300"
                          : task.priority === "medium"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-slate-100 text-slate-800 border border-slate-300"
                      }`}
                    >
                      {task.priority}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-neutral-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Organizer Team Column (1 col) */}
        <div className="space-y-6">
          <h3 className="font-mono text-sm font-bold uppercase flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" /> Organizer Team ({organizers.length})
          </h3>

          {/* Add Organizer */}
          <form
            onSubmit={handleAddOrganizer}
            className="flex flex-col gap-2.5 rounded-lg border border-black bg-white p-4 dark:bg-neutral-900 dark:border-cream"
          >
            <div className="font-mono text-xs font-bold uppercase text-neutral-500">
              Invite Organizer
            </div>
            <Input
              placeholder="Name..."
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="font-mono text-xs"
            />
            <Input
              placeholder="Email..."
              value={newOrgEmail}
              onChange={(e) => setNewOrgEmail(e.target.value)}
              className="font-mono text-xs"
            />
            <select
              value={newOrgRole}
              onChange={(e) =>
                setNewOrgRole(e.target.value as "Lead" | "Logistics" | "Marketing" | "Volunteer")
              }
              className="h-9 rounded-md border border-black bg-cream px-2 font-mono text-xs dark:bg-black dark:border-cream"
            >
              <option value="Lead">Lead</option>
              <option value="Logistics">Logistics</option>
              <option value="Marketing">Marketing</option>
              <option value="Volunteer">Volunteer</option>
            </select>

            <Button
              type="submit"
              size="sm"
              className="font-mono text-xs uppercase bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black mt-1"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Member
            </Button>
          </form>

          {/* Team Member Cards */}
          <div className="space-y-2">
            {organizers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-black bg-white p-3 dark:bg-neutral-900 dark:border-cream"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black bg-amber-200 font-mono text-xs font-bold text-black">
                    {member.name[0]}
                  </div>
                  <div>
                    <div className="font-mono text-xs font-bold">{member.name}</div>
                    <div className="font-mono text-[10px] text-neutral-500">{member.email}</div>
                  </div>
                </div>

                <span className="rounded bg-purple-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-purple-800 border border-purple-300">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
