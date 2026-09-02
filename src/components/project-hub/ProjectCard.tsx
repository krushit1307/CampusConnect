import type { Project, ProjectStatus } from "@/hooks/useProjectHub";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Calendar, Users, FolderOpen, Clock } from "lucide-react";

const STATUS_STYLES: Record<ProjectStatus, { label: string; className: string }> = {
  planning: { label: "Planning", className: "bg-slate-100 text-slate-700" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  "on-hold": { label: "On Hold", className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-blue-100 text-blue-700" },
};

function daysUntilDeadline(deadline?: string): number | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return diff;
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const statusInfo = STATUS_STYLES[project.status];
  const deadlineDays = daysUntilDeadline(project.deadline);
  const doneTasks = project.tasks.filter((t) => t.status === "done").length;
  const overdueTasks = project.tasks.filter(
    (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date(),
  ).length;

  return (
    <Card
      className="cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200 group border-t-3"
      style={{ borderTopColor: project.color }}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: `${project.color}15` }}
            >
              {project.icon}
            </div>
            <div>
              <CardTitle className="text-base font-bold leading-tight group-hover:text-primary transition-colors">
                {project.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {project.description}
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`text-[10px] px-2 py-0 h-5 ${statusInfo.className}`}
          >
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground">
            {doneTasks}/{project.tasks.length} tasks completed
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {project.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{project.members.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              <span>{project.tasks.length}</span>
            </div>
            {overdueTasks > 0 && (
              <div className="flex items-center gap-1 text-red-500">
                <Clock className="h-3 w-3" />
                <span>{overdueTasks} overdue</span>
              </div>
            )}
          </div>

          <div className="flex -space-x-1.5">
            {project.members.slice(0, 3).map((m) => (
              <Avatar key={m.userId} className="h-5 w-5 border border-background">
                <AvatarImage src={m.avatar} alt={m.name} />
                <AvatarFallback className="text-[8px]">{m.name.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
            {project.members.length > 3 && (
              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium border border-background">
                +{project.members.length - 3}
              </div>
            )}
          </div>
        </div>

        {/* Deadline */}
        {deadlineDays !== null && (
          <div
            className={`flex items-center gap-1 text-[10px] ${deadlineDays < 0 ? "text-red-500" : deadlineDays < 7 ? "text-amber-600" : "text-muted-foreground"}`}
          >
            <Calendar className="h-3 w-3" />
            <span>
              {deadlineDays < 0
                ? `${Math.abs(deadlineDays)}d overdue`
                : deadlineDays === 0
                  ? "Due today"
                  : `${deadlineDays}d remaining`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProjectCard;
