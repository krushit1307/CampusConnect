import type { Project, ProjectTask, TaskStatus } from "@/hooks/useProjectHub";
import { TaskCard } from "./TaskCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────

interface ColumnConfig {
  id: TaskStatus;
  title: string;
  color: string;
  bgColor: string;
  icon: string;
}

const COLUMNS: ColumnConfig[] = [
  { id: "backlog", title: "Backlog", color: "text-slate-600", bgColor: "bg-slate-50", icon: "📋" },
  { id: "todo", title: "To Do", color: "text-amber-600", bgColor: "bg-amber-50", icon: "📝" },
  {
    id: "in-progress",
    title: "In Progress",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    icon: "⚡",
  },
  { id: "review", title: "Review", color: "text-purple-600", bgColor: "bg-purple-50", icon: "🔍" },
  { id: "done", title: "Done", color: "text-green-600", bgColor: "bg-green-50", icon: "✅" },
];

// ── Column Component ───────────────────────────────────────────────────────

function KanbanColumn({
  config,
  tasks,
  onMoveTask,
}: {
  config: ColumnConfig;
  tasks: ProjectTask[];
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
}) {
  return (
    <div className="flex flex-col min-w-[260px] max-w-[300px] w-full">
      {/* Column Header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${config.bgColor}`}>
        <span className="text-sm">{config.icon}</span>
        <h3 className={`text-sm font-semibold ${config.color}`}>{config.title}</h3>
        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4">
          {tasks.length}
        </Badge>
      </div>

      {/* Task List */}
      <ScrollArea
        className={`flex-1 rounded-b-lg border ${config.bgColor} border-t-0 p-2 min-h-[200px] max-h-[calc(100vh-320px)]`}
      >
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="relative group">
              <GripVertical className="absolute -left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              <TaskCard
                task={task}
                onMoveTask={config.id !== "done" ? onMoveTask : undefined}
                compact
              />
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No tasks in this column
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Main Board ─────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  project: Project;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
}

export function KanbanBoard({ project, onMoveTask }: KanbanBoardProps) {
  const tasksByStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = project.tasks.filter((t) => t.status === col.id);
      return acc;
    },
    {} as Record<TaskStatus, ProjectTask[]>,
  );

  const totalEstimated = project.tasks.reduce((s, t) => s + t.estimatedHours, 0);
  const totalLogged = project.tasks.reduce((s, t) => s + t.loggedHours, 0);

  return (
    <div className="space-y-4">
      {/* Board Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: `${project.color}15` }}
          >
            {project.icon}
          </div>
          <div>
            <h2 className="text-lg font-bold">{project.name}</h2>
            <p className="text-xs text-muted-foreground">
              {project.tasks.length} tasks · {project.members.length} members · {totalLogged}h /{" "}
              {totalEstimated}h logged
            </p>
          </div>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            config={col}
            tasks={tasksByStatus[col.id] || []}
            onMoveTask={onMoveTask}
          />
        ))}
      </div>
    </div>
  );
}

export default KanbanBoard;
