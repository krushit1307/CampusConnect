import { useMemo } from "react";
import type { ProjectTask, TaskStatus, TaskPriority, ProjectMember } from "@/hooks/useProjectHub";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Clock, Calendar, Tag, AlertTriangle } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-blue-50 text-blue-600 border-blue-200",
  high: "bg-orange-50 text-orange-600 border-orange-200",
  urgent: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-slate-100 text-slate-600",
  todo: "bg-amber-50 text-amber-600",
  "in-progress": "bg-blue-50 text-blue-600",
  review: "bg-purple-50 text-purple-600",
  done: "bg-green-50 text-green-600",
};

// ── Subcomponents ──────────────────────────────────────────────────────────

function SubtaskIndicator({ subtasks }: { subtasks: ProjectTask["subtasks"] }) {
  const completed = subtasks.filter((s) => s.completed).length;
  if (subtasks.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className="flex gap-0.5">
        {subtasks.map((s) => (
          <div
            key={s.id}
            className={`w-1.5 h-1.5 rounded-full ${s.completed ? "bg-green-500" : "bg-slate-300"}`}
          />
        ))}
      </div>
      <span>
        {completed}/{subtasks.length}
      </span>
    </div>
  );
}

function AssigneeBadge({ member }: { member: ProjectMember }) {
  return (
    <div className="flex items-center gap-1.5">
      <Avatar className="h-5 w-5">
        <AvatarImage src={member.avatar} alt={member.name} />
        <AvatarFallback className="text-[10px]">{member.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground truncate max-w-[80px]">
        {member.name.split(" ")[0]}
      </span>
    </div>
  );
}

function TagPills({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 3).map((tag) => (
        <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
          {tag}
        </Badge>
      ))}
      {tags.length > 3 && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
          +{tags.length - 3}
        </Badge>
      )}
    </div>
  );
}

function HoursIndicator({ estimated, logged }: { estimated: number; logged: number }) {
  const pct = estimated > 0 ? Math.min(100, Math.round((logged / estimated) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>
        {logged}h / {estimated}h
      </span>
      <Progress value={pct} className="h-1 w-12" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface TaskCardProps {
  task: ProjectTask;
  onMoveTask?: (taskId: string, newStatus: TaskStatus) => void;
  compact?: boolean;
}

export function TaskCard({ task, onMoveTask, compact = false }: TaskCardProps) {
  const isOverdue = useMemo(
    () => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done",
    [task.dueDate, task.status],
  );

  if (compact) {
    return (
      <Card
        className="cursor-grab hover:shadow-md transition-shadow border-l-2"
        style={{
          borderLeftColor:
            task.priority === "urgent"
              ? "#ef4444"
              : task.priority === "high"
                ? "#f97316"
                : task.priority === "medium"
                  ? "#3b82f6"
                  : "#94a3b8",
        }}
      >
        <CardContent className="p-2.5 space-y-1.5">
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-medium leading-tight line-clamp-2">{task.title}</p>
            {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          </div>
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 ${PRIORITY_STYLES[task.priority]}`}
            >
              {task.priority}
            </Badge>
            {task.assignee && <AssigneeBadge member={task.assignee} />}
          </div>
          <SubtaskIndicator subtasks={task.subtasks} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="hover:shadow-lg transition-all duration-200 border-l-3"
      style={{
        borderLeftColor:
          task.priority === "urgent"
            ? "#ef4444"
            : task.priority === "high"
              ? "#f97316"
              : task.priority === "medium"
                ? "#3b82f6"
                : "#94a3b8",
      }}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight line-clamp-2">
            {task.title}
          </CardTitle>
          {isOverdue && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
              Overdue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2.5">
        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>

        <TagPills tags={task.tags} />

        {task.assignee && (
          <div className="flex items-center justify-between">
            <AssigneeBadge member={task.assignee} />
            {task.dueDate && (
              <div
                className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}
              >
                <Calendar className="h-3 w-3" />
                <span>{task.dueDate}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <HoursIndicator estimated={task.estimatedHours} logged={task.loggedHours} />
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 h-4 ${STATUS_COLORS[task.status]}`}
          >
            {task.status}
          </Badge>
        </div>

        <SubtaskIndicator subtasks={task.subtasks} />

        {onMoveTask && task.status !== "done" && (
          <div className="flex gap-1 pt-1">
            {task.status === "backlog" && (
              <button
                onClick={() => onMoveTask(task.id, "todo")}
                className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition"
              >
                → To Do
              </button>
            )}
            {task.status === "todo" && (
              <button
                onClick={() => onMoveTask(task.id, "in-progress")}
                className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
              >
                → In Progress
              </button>
            )}
            {task.status === "in-progress" && (
              <button
                onClick={() => onMoveTask(task.id, "review")}
                className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition"
              >
                → Review
              </button>
            )}
            {task.status === "review" && (
              <button
                onClick={() => onMoveTask(task.id, "done")}
                className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition"
              >
                → Done ✓
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TaskCard;
