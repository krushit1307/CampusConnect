/**
 * Campus Achievements & Badges
 *
 * Gamified badge system rewarding students for event attendance,
 * club participation, volunteering, and community contributions.
 * Badges have tiers (bronze/silver/gold/platinum) and unlockable
 * requirements that track real progress.
 */

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";
export type BadgeCategory =
  | "attendance"
  | "social"
  | "leadership"
  | "volunteer"
  | "academic"
  | "creative"
  | "streak"
  | "special";
export type AchievementStatus = "locked" | "in_progress" | "unlocked";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  tier: BadgeTier;
  icon_emoji: string;
  /** Points awarded when unlocked */
  points: number;
  /** Total requirement count to unlock */
  requirement_total: number;
  /** Current user progress */
  requirement_current: number;
  /** Whether the user has unlocked this badge */
  status: AchievementStatus;
  /** ISO timestamp when unlocked, null if not yet */
  unlocked_at: string | null;
  /** Percentage progress 0-100 */
  progress_pct: number;
  /** Rarer badges have lower drop rates */
  rarity_pct: number;
  /** The user this achievement belongs to */
  user_id: string;
  user_name: string;
  user_avatar: string | null;
}

export interface AchievementWithProgress extends Achievement {
  /** Breakdown of sub-tasks for this achievement */
  progress_steps: AchievementStep[];
}

export interface AchievementStep {
  label: string;
  completed: boolean;
  completed_at: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  total_points: number;
  total_badges: number;
  highest_tier: BadgeTier;
}

export interface AchievementStats {
  total_points: number;
  badges_unlocked: number;
  badges_total: number;
  current_streak: number;
  longest_streak: number;
  rank_position: number | null;
  tier_counts: Record<BadgeTier, number>;
  category_counts: Record<BadgeCategory, number>;
}

export interface AchievementFilters {
  category: BadgeCategory | "all";
  status: "all" | "unlocked" | "locked" | "in_progress";
  tier: BadgeTier | "all";
  search: string;
}

export const TIER_META: Record<
  BadgeTier,
  { label: string; color: string; bgClass: string; borderClass: string; icon: string }
> = {
  bronze: {
    label: "Bronze",
    color: "#cd7f32",
    bgClass: "bg-orange-100",
    borderClass: "border-orange-300",
    icon: "🥉",
  },
  silver: {
    label: "Silver",
    color: "#c0c0c0",
    bgClass: "bg-gray-100",
    borderClass: "border-gray-300",
    icon: "🥈",
  },
  gold: {
    label: "Gold",
    color: "#ffd700",
    bgClass: "bg-yellow-100",
    borderClass: "border-yellow-400",
    icon: "🥇",
  },
  platinum: {
    label: "Platinum",
    color: "#e5e4e2",
    bgClass: "bg-purple-50",
    borderClass: "border-purple-300",
    icon: "💎",
  },
};

export const CATEGORY_META: Record<
  BadgeCategory,
  { label: string; icon: string; bgClass: string }
> = {
  attendance: { label: "Attendance", icon: "📅", bgClass: "bg-blue-100 text-blue-700" },
  social: { label: "Social", icon: "🤝", bgClass: "bg-pink-100 text-pink-700" },
  leadership: { label: "Leadership", icon: "👑", bgClass: "bg-amber-100 text-amber-700" },
  volunteer: { label: "Volunteer", icon: "💪", bgClass: "bg-green-100 text-green-700" },
  academic: { label: "Academic", icon: "🎓", bgClass: "bg-indigo-100 text-indigo-700" },
  creative: { label: "Creative", icon: "🎨", bgClass: "bg-rose-100 text-rose-700" },
  streak: { label: "Streak", icon: "🔥", bgClass: "bg-orange-100 text-orange-700" },
  special: { label: "Special", icon: "⭐", bgClass: "bg-violet-100 text-violet-700" },
};
