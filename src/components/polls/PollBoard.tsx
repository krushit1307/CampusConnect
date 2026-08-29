import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Plus, LayoutGrid, List, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePolls, usePollStats } from "@/hooks/usePolls";
import { usePollStore } from "@/store/usePollStore";
import { PollCard } from "@/components/polls/PollCard";
import { PollForm } from "@/components/polls/PollForm";
import { PollDetail } from "@/components/polls/PollDetail";
import { POLL_STATUS_META, POLL_TARGET_META } from "@/types/polls";
import type { Poll, PollStatus, PollTarget } from "@/types/polls";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PollBoardProps {
  currentUserId: string | null;
  currentUserName: string;
  currentUserAvatar: string | null;
  isAdmin: boolean;
  clubId?: string | null;
}

type ViewMode = "grid" | "list";

export function PollBoard({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isAdmin,
  clubId = null,
}: PollBoardProps) {
  const { filters, setFilter, resetFilters, setFormOpen } = usePollStore();
  const { data: polls, isLoading, isError, refetch, isFetching } = usePolls(filters);
  const { data: stats } = usePollStats();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback((poll: Poll) => setSelectedId(poll.id), []);
  const handleClose = useCallback(() => setSelectedId(null), []);

  const count = polls?.length ?? 0;
  const activeFilters =
    (filters.status !== "all" ? 1 : 0) +
    (filters.target !== "all" ? 1 : 0) +
    (filters.search ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-700 to-blue-800 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tMTItNHYySDExdi0yaDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <BarChart3 className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Campus Polls</h1>
                <p className="text-indigo-200 text-sm mt-0.5">
                  Quick votes, real-time results, community decisions
                </p>
              </div>
            </div>

            {/* Stats bar */}
            {stats && (
              <div className="flex gap-6 mt-6 text-sm">
                {[
                  { label: "Active", value: stats.active_polls },
                  { label: "Total Polls", value: stats.total_polls },
                  { label: "Votes Cast", value: stats.total_votes_cast },
                  { label: "Avg Participation", value: stats.avg_participation },
                ].map((s) => (
                  <div key={s.label}>
                    <span className="font-mono font-bold text-white tabular-nums">{s.value}</span>
                    <span className="text-indigo-300 ml-1.5">{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 mt-5">
              {currentUserId && (
                <Button
                  onClick={() => setFormOpen(true)}
                  className="rounded-full gap-2 bg-white text-indigo-700 hover:bg-indigo-50 font-bold shadow-lg"
                >
                  <Plus className="h-4 w-4" /> Create Poll
                </Button>
              )}
              <span className="text-sm text-indigo-200 font-mono tabular-nums">
                {count} poll{count !== 1 ? "s" : ""}
                {isFetching && <RefreshCw className="h-3 w-3 animate-spin inline ml-1" />}
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Input
              placeholder="Search polls..."
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              className="h-10 rounded-full text-sm pl-4"
            />
          </div>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilter("status", v as PollStatus | "all")}
          >
            <SelectTrigger className="w-32 h-10 rounded-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {(Object.keys(POLL_STATUS_META) as PollStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {POLL_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.target}
            onValueChange={(v) => setFilter("target", v as PollTarget | "all")}
          >
            <SelectTrigger className="w-36 h-10 rounded-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Targets</SelectItem>
              {(Object.keys(POLL_TARGET_META) as PollTarget[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {POLL_TARGET_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-gray-500 text-xs"
            >
              Clear
            </Button>
          )}
          <div className="flex gap-1 ml-auto">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-3",
            )}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl bg-white border animate-pulse",
                  viewMode === "grid" ? "h-52 p-5" : "h-20 p-4",
                )}
              >
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
            <h3 className="text-lg font-bold text-red-800 mb-2">Failed to load polls</h3>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center"
          >
            <div className="h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-8 w-8 text-indigo-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No polls yet</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">
              Be the first to create a poll and get the campus talking.
            </p>
            {currentUserId && (
              <Button
                onClick={() => setFormOpen(true)}
                className="rounded-full gap-2 bg-indigo-600 hover:bg-indigo-700 font-bold"
              >
                <Plus className="h-4 w-4" /> Create Your First Poll
              </Button>
            )}
          </motion.div>
        )}

        {/* Polls grid/list */}
        {!isLoading && !isError && count > 0 && (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-3",
            )}
          >
            <AnimatePresence mode="popLayout">
              {polls?.map((poll) => (
                <PollCard key={poll.id} poll={poll} onSelect={handleSelect} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Form dialog */}
      {currentUserId && (
        <PollForm
          userId={currentUserId}
          userName={currentUserName}
          userAvatar={currentUserAvatar}
          clubId={clubId}
        />
      )}

      {/* Detail panel */}
      <PollDetail
        pollId={selectedId}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onClose={handleClose}
      />
    </div>
  );
}
