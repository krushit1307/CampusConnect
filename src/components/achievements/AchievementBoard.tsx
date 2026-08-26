import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Trophy,
  Medal,
  Filter,
  Search,
  X,
  TrendingUp,
  Award,
  Crown,
  Zap,
  BarChart3,
  RotateCcw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAchievements,
  useAchievementStats,
  useLeaderboard,
  useRefreshProgress,
} from "@/hooks/useAchievements";
import { useAchievementStore } from "@/store/useAchievementStore";
import { BadgeCard } from "@/components/achievements/BadgeCard";
import { BadgeDetail } from "@/components/achievements/BadgeDetail";
import { TIER_META, CATEGORY_META, type BadgeCategory, type BadgeTier } from "@/types/achievements";
import { cn } from "@/lib/utils";

interface AchievementBoardProps {
  userId: string;
  userName: string;
}

export function AchievementBoard({ userId, userName }: AchievementBoardProps) {
  const { filters, setFilter, resetFilters, selectedBadgeId, setSelectedBadge, setDetailOpen } =
    useAchievementStore();

  const { data: achievements = [], isLoading, isError, refetch } = useAchievements(userId, filters);
  const { data: stats } = useAchievementStats(userId);
  const { data: leaderboard = [] } = useLeaderboard();
  const refreshProgress = useRefreshProgress();
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const selectedAchievement = achievements.find((a) => a.id === selectedBadgeId) ?? null;

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedBadge(id);
      setDetailOpen(true);
    },
    [setSelectedBadge, setDetailOpen],
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedBadge(null);
    setDetailOpen(false);
  }, [setSelectedBadge, setDetailOpen]);

  const count = achievements.length;
  const activeFilters =
    (filters.category !== "all" ? 1 : 0) +
    (filters.tier !== "all" ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.search ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tMTItNHYySDExdi0yaDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Trophy className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Achievements</h1>
                <p className="text-orange-200 text-sm">Badges, points, and bragging rights</p>
              </div>
            </div>

            {/* Stats row */}
            {stats && (
              <div className="flex flex-wrap gap-4 mt-5">
                <StatPill
                  icon={<Trophy className="h-4 w-4" />}
                  value={stats.total_points}
                  label="points"
                />
                <StatPill
                  icon={<Award className="h-4 w-4" />}
                  value={`${stats.badges_unlocked}/${stats.badges_total}`}
                  label="badges"
                />
                <StatPill
                  icon={<Zap className="h-4 w-4" />}
                  value={stats.current_streak}
                  label="day streak"
                />
                {stats.rank_position && (
                  <StatPill
                    icon={<Crown className="h-4 w-4" />}
                    value={`#${stats.rank_position}`}
                    label="rank"
                  />
                )}
              </div>
            )}

            {/* Tier progress bars */}
            {stats && (
              <div className="flex gap-3 mt-4">
                {(["platinum", "gold", "silver", "bronze"] as BadgeTier[]).map((tier) => {
                  const total = stats.tier_counts[tier];
                  const pct =
                    stats.badges_total > 0 ? Math.round((total / stats.badges_total) * 100) : 0;
                  return (
                    <div key={tier} className="flex-1 max-w-[100px]">
                      <div className="flex items-center justify-between text-[10px] text-white/80 mb-1">
                        <span>
                          {TIER_META[tier].icon} {TIER_META[tier].label}
                        </span>
                        <span className="font-mono">{total}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                          className="h-full rounded-full bg-white/80"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-3 mt-5">
              <Button
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                variant="outline"
                className="rounded-full gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20 font-bold text-sm"
              >
                <Users className="h-4 w-4" /> Leaderboard
              </Button>
              <Button
                onClick={() => refreshProgress.mutate(userId)}
                disabled={refreshProgress.isPending}
                variant="outline"
                className="rounded-full gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20 font-bold text-sm"
              >
                <RotateCcw className={cn("h-4 w-4", refreshProgress.isPending && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Leaderboard slide-down */}
        <AnimatePresence>
          {showLeaderboard && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-gray-200 bg-white p-4 mb-2">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" /> Top Contributors
                </h3>
                <div className="space-y-2">
                  {leaderboard.slice(0, 10).map((entry) => (
                    <div key={entry.user_id} className="flex items-center gap-3 py-1.5">
                      <span
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold",
                          entry.rank <= 3
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-500",
                        )}
                      >
                        {entry.rank}
                      </span>
                      <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-700 overflow-hidden">
                        {entry.user_avatar ? (
                          <img
                            src={entry.user_avatar}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          entry.user_name.charAt(0)
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                        {entry.user_name}
                      </span>
                      <span className="text-xs font-mono text-gray-400">
                        {entry.total_badges} badges
                      </span>
                      <span className="text-sm font-bold text-indigo-600 font-mono">
                        {entry.total_points} pts
                      </span>
                    </div>
                  ))}
                  {leaderboard.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No leaderboard data yet.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search badges..."
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              className="h-10 rounded-full text-sm pl-9"
            />
          </div>
          <Select
            value={filters.category}
            onValueChange={(v) => setFilter("category", v as BadgeCategory | "all")}
          >
            <SelectTrigger className="w-36 h-10 rounded-full text-sm">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {(Object.keys(CATEGORY_META) as BadgeCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.tier}
            onValueChange={(v) => setFilter("tier", v as BadgeTier | "all")}
          >
            <SelectTrigger className="w-32 h-10 rounded-full text-sm">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              {(Object.keys(TIER_META) as BadgeTier[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TIER_META[t].icon} {TIER_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => setFilter("status", v as any)}>
            <SelectTrigger className="w-36 h-10 rounded-full text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unlocked">✅ Unlocked</SelectItem>
              <SelectItem value="in_progress">⏳ In Progress</SelectItem>
              <SelectItem value="locked">🔒 Locked</SelectItem>
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-gray-500 text-xs gap-1"
            >
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <h3 className="font-bold text-red-800 mb-2">Failed to load achievements</h3>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="rounded-full gap-2 border-red-300 text-red-700"
            >
              <RotateCcw className="h-4 w-4" /> Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && count === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Trophy className="h-12 w-12 text-amber-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-800 mb-1">No badges found</h3>
            <p className="text-sm text-gray-500">
              {activeFilters > 0
                ? "Try adjusting your filters to see more badges."
                : "Attend events, volunteer, and participate to earn badges!"}
            </p>
          </div>
        )}

        {/* Badge grid */}
        {!isLoading && !isError && count > 0 && (
          <>
            <p className="text-sm text-gray-500">
              Showing <span className="font-semibold text-gray-700">{count}</span> badge
              {count !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {achievements.map((ach) => (
                  <BadgeCard key={ach.id} achievement={ach} onSelect={handleSelect} />
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* Detail panel */}
      <BadgeDetail achievement={selectedAchievement} onClose={handleCloseDetail} />
    </div>
  );
}

// ─── Stat pill sub-component ─────────────────────────────────────────────────

function StatPill({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-sm">
      {icon}
      <span className="font-bold tabular-nums">{value}</span>
      <span className="text-white/70">{label}</span>
    </div>
  );
}
