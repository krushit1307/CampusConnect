import type { HubStats } from "@/hooks/useProjectHub";
import { Card, CardContent } from "@/components/ui/card";
import { FolderOpen, CheckCircle, AlertCircle, Users, BarChart3, Zap } from "lucide-react";

const STAT_CONFIG = [
  {
    key: "totalProjects" as const,
    label: "Total Projects",
    icon: FolderOpen,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    key: "activeProjects" as const,
    label: "Active",
    icon: Zap,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    key: "totalTasks" as const,
    label: "Tasks",
    icon: BarChart3,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "completedTasks" as const,
    label: "Completed",
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    key: "overdueTasks" as const,
    label: "Overdue",
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    key: "totalMembers" as const,
    label: "Members",
    icon: Users,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
] as const;

interface ProjectStatsBarProps {
  stats: HubStats;
}

export function ProjectStatsBar({ stats }: ProjectStatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {STAT_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
        <Card key={key} className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{stats[key]}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default ProjectStatsBar;
