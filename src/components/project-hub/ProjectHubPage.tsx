import { useState, useMemo } from "react";
import { useProjectHub } from "@/hooks/useProjectHub";
import type { ProjectStatus } from "@/hooks/useProjectHub";
import { ProjectCard } from "./ProjectCard";
import { KanbanBoard } from "./KanbanBoard";
import { ProjectStatsBar } from "./ProjectStatsBar";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Plus,
  ArrowLeft,
  LayoutGrid,
  Columns3,
  Filter,
  X,
  Calendar,
  Users,
  FolderOpen,
  Clock,
  Target,
  Settings,
} from "lucide-react";

// ── Status Filters ─────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ProjectStatus | "all"; label: string; icon?: string }[] = [
  { value: "all", label: "All Projects" },
  { value: "planning", label: "Planning", icon: "📋" },
  { value: "active", label: "Active", icon: "⚡" },
  { value: "on-hold", label: "On Hold", icon: "⏸️" },
  { value: "completed", label: "Completed", icon: "✅" },
];

// ── Project Detail View ────────────────────────────────────────────────────

function ProjectDetailView({
  project,
  onBack,
  onMoveTask,
}: {
  project: NonNullable<ReturnType<typeof useProjectHub>["selectedProject"]>;
  onBack: () => void;
  onMoveTask: (taskId: string, status: any) => void;
}) {
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  const taskStats = useMemo(() => {
    const counts = { total: project.tasks.length, done: 0, inProgress: 0, overdue: 0 };
    project.tasks.forEach((t) => {
      if (t.status === "done") counts.done++;
      if (t.status === "in-progress") counts.inProgress++;
      if (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done") counts.overdue++;
    });
    return counts;
  }, [project]);

  const completionRate =
    taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: `${project.color}15` }}
          >
            {project.icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.description}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-2.5">
            <Target className="h-4 w-4 text-indigo-500" />
            <div>
              <p className="text-sm font-bold">{completionRate}%</p>
              <p className="text-[10px] text-muted-foreground">Completion</p>
            </div>
            <Progress value={completionRate} className="h-1 ml-auto w-16" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2.5">
            <FolderOpen className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm font-bold">{taskStats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total Tasks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm font-bold">{taskStats.inProgress}</p>
              <p className="text-[10px] text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-red-500" />
            <div>
              <p className="text-sm font-bold">{taskStats.overdue}</p>
              <p className="text-[10px] text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members + Tags + Info */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mr-1">Team:</span>
          <div className="flex -space-x-1">
            {project.members.map((m) => (
              <Avatar key={m.userId} className="h-6 w-6 border-2 border-background" title={m.name}>
                <AvatarImage src={m.avatar} alt={m.name} />
                <AvatarFallback className="text-[9px]">{m.name.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>

        <div className="flex gap-1">
          {project.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {tag}
            </Badge>
          ))}
        </div>

        {project.deadline && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Deadline: {project.deadline}
          </div>
        )}
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Task Board
        </h3>
        <div className="flex gap-1">
          <Button
            variant={viewMode === "board" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("board")}
            className="h-7 text-xs"
          >
            <Columns3 className="h-3 w-3 mr-1" /> Board
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-7 text-xs"
          >
            <LayoutGrid className="h-3 w-3 mr-1" /> List
          </Button>
        </div>
      </div>

      {/* Kanban Board or List */}
      {viewMode === "board" ? (
        <KanbanBoard project={project} onMoveTask={onMoveTask} />
      ) : (
        <div className="space-y-2">
          {project.tasks.map((task) => (
            <Card key={task.id} className="flex items-center gap-3 p-3">
              <Badge
                variant="outline"
                className={`text-[10px] w-20 justify-center ${
                  task.status === "done"
                    ? "bg-green-50 text-green-700"
                    : task.status === "in-progress"
                      ? "bg-blue-50 text-blue-700"
                      : task.status === "review"
                        ? "bg-purple-50 text-purple-700"
                        : task.status === "todo"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-50 text-slate-700"
                }`}
              >
                {task.status}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{task.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {task.assignee && (
                  <div className="flex items-center gap-1">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={task.assignee.avatar} />
                      <AvatarFallback className="text-[8px]">
                        {task.assignee.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-muted-foreground">
                      {task.assignee.name.split(" ")[0]}
                    </span>
                  </div>
                )}
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 h-4 ${
                    task.priority === "urgent"
                      ? "bg-red-50 text-red-600"
                      : task.priority === "high"
                        ? "bg-orange-50 text-orange-600"
                        : task.priority === "medium"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-slate-50 text-slate-600"
                  }`}
                >
                  {task.priority}
                </Badge>
                {task.status !== "done" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[10px] px-2"
                    onClick={() => {
                      const nextStatus: Record<string, string> = {
                        backlog: "todo",
                        todo: "in-progress",
                        "in-progress": "review",
                        review: "done",
                      };
                      const next = nextStatus[task.status];
                      if (next) onMoveTask(task.id, next);
                    }}
                  >
                    Advance →
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function ProjectHubPage() {
  const {
    filteredProjects,
    selectedProject,
    selectedProjectId,
    setSelectedProjectId,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    stats,
    filters,
    updateFilters,
    resetFilters,
    moveTask,
  } = useProjectHub();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-2xl">🏗️</span>
              Project Collaboration Hub
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage campus projects, track tasks, and collaborate with your team.
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Project
          </Button>
        </div>

        {/* Stats */}
        <ProjectStatsBar stats={stats} />

        {/* Filters + View Toggle */}
        {selectedProject === null && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  className="pl-8 h-8 w-[200px] text-sm"
                  value={filters.searchQuery}
                  onChange={(e) => updateFilters({ searchQuery: e.target.value })}
                />
              </div>

              <Select
                value={filters.status || "all"}
                onValueChange={(v) =>
                  updateFilters({ status: v === "all" ? null : (v as ProjectStatus) })
                }
              >
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.icon ? `${opt.icon} ` : ""}
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(filters.searchQuery || filters.status) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>

            <div className="flex gap-1 sm:ml-auto">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setViewMode("list")}
              >
                <Filter className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        {selectedProject ? (
          <ProjectDetailView
            project={selectedProject}
            onBack={() => setSelectedProjectId(null)}
            onMoveTask={moveTask}
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => setSelectedProjectId(project.id)}
              />
            ))}
            {filteredProjects.length === 0 && (
              <div className="col-span-full text-center py-16">
                <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No projects match your filters.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={resetFilters}>
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProjects.map((project) => {
              const doneTasks = project.tasks.filter((t) => t.status === "done").length;
              return (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: `${project.color}15` }}
                    >
                      {project.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{project.name}</h3>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {project.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {project.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {doneTasks}/{project.tasks.length}
                        </p>
                        <p className="text-[10px] text-muted-foreground">tasks done</p>
                      </div>
                      <Progress value={project.progress} className="h-1.5 w-20" />
                      <div className="flex -space-x-1">
                        {project.members.slice(0, 3).map((m) => (
                          <Avatar key={m.userId} className="h-6 w-6 border-2 border-background">
                            <AvatarImage src={m.avatar} alt={m.name} />
                            <AvatarFallback className="text-[9px]">
                              {m.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Project Dialog */}
        <CreateProjectDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={(data) => {
            console.log("Create project:", data);
          }}
        />
      </div>
    </div>
  );
}

export default ProjectHubPage;
