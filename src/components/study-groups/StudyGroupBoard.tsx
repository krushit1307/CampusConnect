import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  Users,
  Calendar,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudyGroups, useStudyGroupStats } from "@/hooks/useStudyGroups";
import { useStudyGroupStore } from "@/store/useStudyGroupStore";
import { GroupCard } from "@/components/study-groups/GroupCard";
import { GroupForm } from "@/components/study-groups/GroupForm";
import { GroupDetail } from "@/components/study-groups/GroupDetail";
import { PRIVACY_META, type GroupPrivacy } from "@/types/studyGroups";
import { cn } from "@/lib/utils";

interface StudyGroupBoardProps {
  currentUserId: string | null;
  currentUserName: string;
  currentUserAvatar: string | null;
}

export function StudyGroupBoard({
  currentUserId,
  currentUserName,
  currentUserAvatar,
}: StudyGroupBoardProps) {
  const { filters, setFilter, resetFilters, setFormOpen } = useStudyGroupStore();
  const { data: groups = [], isLoading, isError, refetch } = useStudyGroups(filters);
  const { data: stats } = useStudyGroupStats(currentUserId ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const handleSelect = useCallback((g: any) => setSelectedId(g.id), []);
  const handleClose = useCallback(() => setSelectedId(null), []);

  const count = groups.length;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tMTItNHYySDExdi0yaDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <BookOpen className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Study Groups</h1>
                <p className="text-emerald-200 text-sm">Find your crew, ace your courses</p>
              </div>
            </div>

            {stats && (
              <div className="flex flex-wrap gap-4 mt-5 text-sm">
                {[
                  {
                    icon: <BookOpen className="h-4 w-4" />,
                    value: stats.total_groups,
                    label: "groups",
                  },
                  {
                    icon: <Users className="h-4 w-4" />,
                    value: stats.my_groups,
                    label: "my groups",
                  },
                  {
                    icon: <Calendar className="h-4 w-4" />,
                    value: stats.total_sessions_scheduled,
                    label: "sessions",
                  },
                  {
                    icon: <FileText className="h-4 w-4" />,
                    value: stats.total_resources,
                    label: "resources",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5"
                  >
                    {s.icon}
                    <span className="font-bold tabular-nums">{s.value}</span>
                    <span className="text-white/70">{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-5">
              {currentUserId && (
                <Button
                  onClick={() => setFormOpen(true)}
                  className="rounded-full gap-2 bg-white text-emerald-700 hover:bg-emerald-50 font-bold shadow-lg"
                >
                  <Plus className="h-4 w-4" /> Create Group
                </Button>
              )}
              <span className="text-sm text-emerald-200 font-mono">{count} groups</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search groups or courses..."
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              className="h-10 rounded-full text-sm pl-9"
            />
          </div>
          <Select
            value={filters.privacy}
            onValueChange={(v) => setFilter("privacy", v as GroupPrivacy | "all")}
          >
            <SelectTrigger className="w-36 h-10 rounded-full text-sm">
              <SelectValue placeholder="Privacy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {(Object.keys(PRIVACY_META) as GroupPrivacy[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIVACY_META[p].icon} {PRIVACY_META[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => setFilter("sort", v as any)}>
            <SelectTrigger className="w-40 h-10 rounded-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="most_members">Most Members</SelectItem>
            </SelectContent>
          </Select>
          {currentUserId && (
            <Button
              variant={filters.has_my_groups ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("has_my_groups", !filters.has_my_groups)}
              className="rounded-full text-xs h-10"
            >
              My Groups Only
            </Button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl bg-white border animate-pulse p-5">
                <div className="flex gap-2 mb-3">
                  <div className="h-5 w-16 rounded bg-gray-200" />
                  <div className="h-5 w-20 rounded bg-gray-200" />
                </div>
                <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-full bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <h3 className="font-bold text-red-800 mb-2">Failed to load groups</h3>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="rounded-full gap-2 border-red-300"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && count === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <BookOpen className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">No study groups found</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
              Start a group for your course and find study buddies.
            </p>
            {currentUserId && (
              <Button
                onClick={() => setFormOpen(true)}
                className="rounded-full gap-2 bg-emerald-600 hover:bg-emerald-700 font-bold"
              >
                <Plus className="h-4 w-4" /> Create First Group
              </Button>
            )}
          </div>
        )}

        {/* Groups grid */}
        {!isLoading && !isError && count > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} onSelect={handleSelect} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Forms */}
      {currentUserId && (
        <GroupForm
          userId={currentUserId}
          userName={currentUserName}
          userAvatar={currentUserAvatar}
        />
      )}

      {/* Detail */}
      <GroupDetail
        groupId={selectedId}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        onClose={handleClose}
      />
    </div>
  );
}
