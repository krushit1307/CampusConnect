import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useAchievementStore } from "@/store/useAchievementStore";
import type {
  Achievement,
  AchievementFilters,
  AchievementStats,
  LeaderboardEntry,
  BadgeCategory,
  BadgeTier,
} from "@/types/achievements";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const achievementKeys = {
  all: ["achievements"] as const,
  lists: () => [...achievementKeys.all, "list"] as const,
  list: (userId: string, filters: AchievementFilters) =>
    [...achievementKeys.lists(), userId, filters] as const,
  detail: (id: string) => [...achievementKeys.all, "detail", id] as const,
  stats: (userId: string) => [...achievementKeys.all, "stats", userId] as const,
  leaderboard: () => [...achievementKeys.all, "leaderboard"] as const,
  recentUnlocks: (userId: string) => [...achievementKeys.all, "recent", userId] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Fetch achievements for a user with filters */
export function useAchievements(userId: string, filters: AchievementFilters) {
  const store = useAchievementStore();

  return useQuery({
    queryKey: achievementKeys.list(userId, filters),
    queryFn: async () => {
      store.setStatus("loading");
      const supabase = createClient();

      let query = supabase
        .from("achievements")
        .select("*")
        .eq("user_id", userId)
        .order("unlocked_at", { ascending: false, nullsFirst: false })
        .order("progress_pct", { ascending: false });

      if (filters.category !== "all") {
        query = query.eq("category", filters.category as BadgeCategory);
      }
      if (filters.tier !== "all") {
        query = query.eq("tier", filters.tier as BadgeTier);
      }
      if (filters.status === "unlocked") {
        query = query.eq("status", "unlocked");
      } else if (filters.status === "locked") {
        query = query.eq("status", "locked");
      } else if (filters.status === "in_progress") {
        query = query.eq("status", "in_progress");
      }
      if (filters.search.trim()) {
        query = query.or(
          `name.ilike.%${filters.search.trim()}%,description.ilike.%${filters.search.trim()}%`,
        );
      }

      const { data, error } = await query.limit(60);
      if (error) {
        store.setError(error.message);
        throw new Error(error.message);
      }

      const achievements = (data ?? []) as Achievement[];
      store.setStatus("success");
      return achievements;
    },
    staleTime: 30_000,
    enabled: !!userId,
  });
}

/** Fetch achievement stats */
export function useAchievementStats(userId: string) {
  return useQuery({
    queryKey: achievementKeys.stats(userId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("achievements")
        .select("points, status, tier, category, progress_pct")
        .eq("user_id", userId);

      if (error) throw new Error(error.message);

      const rows = (data ?? []) as {
        points: number;
        status: string;
        tier: BadgeTier;
        category: BadgeCategory;
        progress_pct: number;
      }[];

      const tier_counts: Record<BadgeTier, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
      const category_counts: Record<BadgeCategory, number> = {
        attendance: 0,
        social: 0,
        leadership: 0,
        volunteer: 0,
        academic: 0,
        creative: 0,
        streak: 0,
        special: 0,
      };

      let badges_unlocked = 0;
      let total_points = 0;

      for (const row of rows) {
        if (row.status === "unlocked") {
          badges_unlocked++;
          total_points += row.points;
          tier_counts[row.tier]++;
          category_counts[row.category]++;
        }
      }

      const stats: AchievementStats = {
        total_points,
        badges_unlocked,
        badges_total: rows.length,
        current_streak: 0,
        longest_streak: 0,
        rank_position: null,
        tier_counts,
        category_counts,
      };
      return stats;
    },
    staleTime: 60_000,
    enabled: !!userId,
  });
}

/** Fetch leaderboard */
export function useLeaderboard() {
  return useQuery({
    queryKey: achievementKeys.leaderboard(),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("achievements")
        .select("user_id, points, tier, status");

      if (error) throw new Error(error.message);

      const rows = (data ?? []) as {
        user_id: string;
        points: number;
        tier: BadgeTier;
        status: string;
      }[];

      // Aggregate per user
      const userMap = new Map<
        string,
        { total_points: number; total_badges: number; highest_tier_idx: number }
      >();
      const tierOrder: BadgeTier[] = ["platinum", "gold", "silver", "bronze"];

      for (const row of rows) {
        if (row.status !== "unlocked") continue;
        const existing = userMap.get(row.user_id) ?? {
          total_points: 0,
          total_badges: 0,
          highest_tier_idx: 3,
        };
        const tierIdx = tierOrder.indexOf(row.tier);
        existing.total_points += row.points;
        existing.total_badges++;
        if (tierIdx < existing.highest_tier_idx) existing.highest_tier_idx = tierIdx;
        userMap.set(row.user_id, existing);
      }

      // Fetch profile names
      const userIds = [...userMap.keys()];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds.length > 0 ? userIds : ["__none__"]);

      const profileMap = new Map(
        (profiles ?? []).map((p: any) => [
          p.id,
          { name: p.full_name ?? "Student", avatar: p.avatar_url },
        ]),
      );

      const sorted = [...userMap.entries()]
        .sort((a, b) => b[1].total_points - a[1].total_points)
        .slice(0, 50);

      return sorted.map(([userId, data], idx): LeaderboardEntry => ({
        rank: idx + 1,
        user_id: userId,
        user_name: profileMap.get(userId)?.name ?? "Student",
        user_avatar: profileMap.get(userId)?.avatar ?? null,
        total_points: data.total_points,
        total_badges: data.total_badges,
        highest_tier: tierOrder[data.highest_tier_idx],
      }));
    },
    staleTime: 30_000,
  });
}

/** Fetch recent unlocks */
export function useRecentUnlocks(userId: string) {
  return useQuery({
    queryKey: achievementKeys.recentUnlocks(userId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "unlocked")
        .order("unlocked_at", { ascending: false })
        .limit(5);

      if (error) throw new Error(error.message);
      return (data ?? []) as Achievement[];
    },
    staleTime: 30_000,
    enabled: !!userId,
  });
}

/** Claim / refresh achievement progress */
export function useRefreshProgress() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const supabase = createClient();
      // Simulate a server-side recalculation by fetching current state
      const { data, error } = await supabase
        .from("achievements")
        .select("id, requirement_total, requirement_current, status")
        .eq("user_id", userId);

      if (error) throw error;
      return (data ?? []).length;
    },
    onSuccess: (_count, userId) => {
      qc.invalidateQueries({ queryKey: achievementKeys.all });
      toast.success("Progress refreshed!");
    },
    onError: () => toast.error("Failed to refresh progress."),
  });
}
